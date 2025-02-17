import { describe, it, expect } from 'vitest';
import { SingleStreamProjection } from '../src/projections/single-stream-projection';
import { EventClient } from '../src/event-client';
import { z } from 'zod';
import { ulid } from 'ulidx';
import { DataFilter } from '../src/query-types';

const eventSchema = z.object({
  type: z.literal('TEST_EVENT'),
  data: z.object({
    id: z.string(),
  }),
});

const eventUnion = z.discriminatedUnion('type', [eventSchema]);

const projectionSchema = z.object({
  ids: z.array(z.string()),
});

class TestProjection extends SingleStreamProjection<
  typeof eventUnion,
  typeof eventUnion,
  typeof projectionSchema
> {
  private projectionId = ulid();

  get id(): string {
    return this.projectionId;
  }

  get type(): string {
    return 'test-projection';
  }

  get jsonSchema() {
    return projectionSchema;
  }

  get types(): Array<z.infer<typeof eventUnion>['type']> {
    return ['TEST_EVENT'];
  }

  get filter(): DataFilter | undefined {
    return undefined;
  }

  // Expose protected methods for testing
  public async testGetExistingState(): Promise<z.infer<
    typeof projectionSchema
  > | null> {
    return this.getExistingState();
  }

  public async testGetEvents(): Promise<Array<z.infer<typeof eventUnion>>> {
    return this.getEvents();
  }

  public async testReduceOnlyDbEvents<T>(
    reducer: (acc: T, event: z.infer<typeof eventUnion>) => T,
    defaultValue: T,
  ): Promise<T> {
    return this.reduceOnlyDbEvents(reducer, defaultValue);
  }

  public async testReduceEvents<T>(
    reducer: (acc: T, event: z.infer<typeof eventUnion>) => T,
    defaultValue: T,
  ): Promise<T> {
    return this.reduceEvents(reducer, defaultValue);
  }

  async asJson(): Promise<z.infer<typeof projectionSchema>> {
    const events = await this.getEvents();
    return {
      ids: events.map((event) => event.data.id),
    };
  }
}

describe('SingleStreamProjection', () => {
  const client = {} as EventClient<typeof eventUnion, typeof eventUnion>;

  describe('constructor', () => {
    it('should set loadExisting to false by default', () => {
      const projection = new TestProjection(client);
      expect(projection['loadExisting']).toBe(false);
    });

    it('should set loadExisting from options', () => {
      const projection = new TestProjection(client, { loadExisting: true });
      expect(projection['loadExisting']).toBe(true);
    });
  });

  describe('getExistingState', () => {
    it('should return null when loadExisting is false', async () => {
      const projection = new TestProjection(client);
      const state = await projection.testGetExistingState();
      expect(state).toBeNull();
    });

    it('should return null when no projection exists', async () => {
      const projection = new TestProjection(client, { loadExisting: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getProjection: () => Promise.resolve(null),
      };

      const state = await projection.testGetExistingState();
      expect(state).toBeNull();
    });

    it('should return parsed projection data', async () => {
      const projection = new TestProjection(client, { loadExisting: true });
      const data = { ids: [ulid()] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getProjection: () =>
          Promise.resolve({
            data,
            lastEventId: 123n,
          }),
      };

      const state = await projection.testGetExistingState();
      expect(state).toEqual(data);
    });

    it('should handle projection loading error', async () => {
      const projection = new TestProjection(client, { loadExisting: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getProjection: () => Promise.reject(new Error('Load error')),
      };

      await expect(projection.testGetExistingState()).rejects.toThrow(
        'Load error',
      );
    });
  });

  describe('getEvents', () => {
    it('should get events without afterId when no projection exists', async () => {
      const projection = new TestProjection(client, { loadExisting: true });
      const events = [
        {
          type: 'TEST_EVENT' as const,
          data: { id: ulid() },
        },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getProjection: () => Promise.resolve(null),
        getEventStream: (query: { types: string[]; filter?: unknown }) => {
          expect(query.types).toEqual(['TEST_EVENT']);
          expect(query.filter).toBeUndefined();
          return Promise.resolve(events);
        },
      };

      const result = await projection.testGetEvents();
      expect(result).toEqual(events);
    });

    it('should get events after lastEventId when projection exists', async () => {
      const projection = new TestProjection(client, { loadExisting: true });
      const events = [
        {
          type: 'TEST_EVENT' as const,
          data: { id: ulid() },
        },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getProjection: () =>
          Promise.resolve({
            data: { ids: [] },
            lastEventId: 123n,
          }),
        getEventStream: (query: {
          types: string[];
          filter?: unknown;
          afterId: bigint;
        }) => {
          expect(query.types).toEqual(['TEST_EVENT']);
          expect(query.filter).toBeUndefined();
          expect(query.afterId).toBe(123n);
          return Promise.resolve(events);
        },
      };

      const result = await projection.testGetEvents();
      expect(result).toEqual(events);
    });

    it('should get events after lastEventId when projection exists and filter is set', async () => {
      class FilteredTestProjection extends TestProjection {
        get filter() {
          return { id: { eq: 'test' } };
        }
      }

      const projection = new FilteredTestProjection(client, {
        loadExisting: true,
      });
      const events = [
        {
          type: 'TEST_EVENT' as const,
          data: { id: ulid() },
        },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getProjection: () =>
          Promise.resolve({
            data: { ids: [] },
            lastEventId: 123n,
          }),
        getEventStream: (query: {
          types: string[];
          filter: { id: { eq: string } };
          afterId: bigint;
        }) => {
          expect(query.types).toEqual(['TEST_EVENT']);
          expect(query.filter).toEqual({ id: { eq: 'test' } });
          expect(query.afterId).toBe(123n);
          return Promise.resolve(events);
        },
      };

      const result = await projection.testGetEvents();
      expect(result).toEqual(events);
    });

    it('should get events when loadExistingProjection returns null', async () => {
      const projection = new TestProjection(client, { loadExisting: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).loadExistingProjection = () => Promise.resolve(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getEventStream: (query: { types: string[]; filter?: unknown }) => {
          expect(query.types).toEqual(['TEST_EVENT']);
          expect(query.filter).toBeUndefined();
          return Promise.reject();
        },
      };

      await expect(projection.testGetEvents()).rejects.toThrow();
    });

    it('should include applied events in result', async () => {
      const projection = new TestProjection(client);
      const event1 = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      const event2 = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getEventStream: () => Promise.resolve([event1]),
      };
      projection.apply(event2);

      const result = await projection.testGetEvents();
      expect(result).toEqual([event1, event2]);
    });

    it('should handle event loading error', async () => {
      const projection = new TestProjection(client);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getEventStream: () => Promise.reject(new Error('Load error')),
      };

      await expect(projection.testGetEvents()).rejects.toThrow('Load error');
    });
  });

  describe('reduceOnlyDbEvents', () => {
    it('should reduce only cached events', async () => {
      const projection = new TestProjection(client);
      const event1 = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      const event2 = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).cachedEventsPromise = Promise.resolve([
        event1,
        event2,
      ]);

      const result = await projection.testReduceOnlyDbEvents(
        (acc: string[], event) => [...acc, event.data.id],
        [],
      );
      expect(result).toEqual([event1.data.id, event2.data.id]);
    });

    it('should handle error in getEventStream', async () => {
      const projection = new TestProjection(client);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getEventStream: () => Promise.reject(new Error('Load error')),
      };

      await expect(
        projection.testReduceOnlyDbEvents(
          (acc: string[], event) => [...acc, event.data.id],
          [],
        ),
      ).rejects.toThrow('Load error');
    });
  });

  describe('reduceEvents', () => {
    it('should reduce both cached and applied events', async () => {
      const projection = new TestProjection(client);
      const event1 = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      const event2 = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      const event3 = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).cachedEventsPromise = Promise.resolve([
        event1,
        event2,
      ]);
      projection.apply(event3);

      const result = await projection.testReduceEvents(
        (acc: string[], event) => [...acc, event.data.id],
        [],
      );
      expect(result).toEqual([event1.data.id, event2.data.id, event3.data.id]);
    });

    it('should handle error in getEventStream', async () => {
      const projection = new TestProjection(client);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getEventStream: () => Promise.reject(new Error('Load error')),
      };

      await expect(
        projection.testReduceEvents(
          (acc: string[], event) => [...acc, event.data.id],
          [],
        ),
      ).rejects.toThrow('Load error');
    });
  });

  describe('apply', () => {
    it('should handle empty array', () => {
      const projection = new TestProjection(client);
      projection.apply([]);
      expect(projection['appliedEvents']).toHaveLength(0);
    });

    it('should handle single event', () => {
      const projection = new TestProjection(client);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      projection.apply(event);
      expect(projection['appliedEvents']).toHaveLength(1);
      expect(projection['appliedEvents'][0]).toEqual(event);
    });
  });

  describe('refresh', () => {
    it('should reset promises and load existing projection', async () => {
      const projection = new TestProjection(client, { loadExisting: true });
      const data = { ids: [ulid()] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getProjection: () =>
          Promise.resolve({
            data,
            lastEventId: 123n,
          }),
      };

      await projection.refresh();
      const state = await projection.testGetExistingState();
      expect(state).toEqual(data);
    });

    it('should handle error in getProjection', async () => {
      const projection = new TestProjection(client, { loadExisting: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getProjection: () => Promise.reject(new Error('Load error')),
      };

      await expect(projection.refresh()).rejects.toThrow('Load error');
    });
  });

  describe('save', () => {
    it('should save projection data', async () => {
      const projection = new TestProjection(client);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).cachedEventsPromise = Promise.resolve([event]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getEventStream: () => Promise.resolve([event]),
        saveProjection: (data: unknown) => {
          expect(data).toEqual({
            type: 'test-projection',
            id: projection.id,
            data: { ids: [event.data.id] },
          });
          return Promise.resolve();
        },
      };

      await projection.save();
    });

    it('should handle error in saveProjection', async () => {
      const projection = new TestProjection(client);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).cachedEventsPromise = Promise.resolve([event]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getEventStream: () => Promise.resolve([event]),
        saveProjection: () => Promise.reject(new Error('Save error')),
      };

      await expect(projection.save()).rejects.toThrow('Save error');
    });

    it('should throw error when trying to save with applied events', async () => {
      const projection = new TestProjection(client);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      projection.apply(event);

      await expect(projection.save()).rejects.toThrow(
        'Cannot save projection with applied events',
      );
    });

    it('should throw error when trying to save with no events', async () => {
      const projection = new TestProjection(client);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).cachedEventsPromise = Promise.resolve([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projection as any).eventClient = {
        getProjection: () => Promise.resolve(null),
      };

      await expect(projection.save()).rejects.toThrow(
        'Cannot save projection with no events',
      );
    });
  });
});
