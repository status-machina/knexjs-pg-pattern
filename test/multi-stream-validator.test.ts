import { describe, it, expect } from 'vitest';
import { MultiStreamValidator } from '../src/validators/multi-stream-validator';
import { EventClient } from '../src/event-client';
import { z } from 'zod';
import { ulid } from 'ulidx';

const eventSchema = z.object({
  type: z.literal('TEST_EVENT'),
  data: z.object({
    id: z.string(),
  }),
});

const eventUnion = z.discriminatedUnion('type', [eventSchema]);

class TestValidator extends MultiStreamValidator<
  typeof eventUnion,
  typeof eventUnion
> {
  async isValid(): Promise<boolean> {
    return true;
  }

  // Expose protected methods for testing
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
}

class InvalidTestValidator extends MultiStreamValidator<
  typeof eventUnion,
  typeof eventUnion
> {
  async isValid(): Promise<boolean> {
    return false;
  }
}

describe('MultiStreamValidator', () => {
  const client = {} as EventClient<typeof eventUnion, typeof eventUnion>;

  describe('apply', () => {
    it('should handle empty array', () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      validator.apply([]);
      expect(validator['appliedEvents']).toHaveLength(0);
    });

    it('should handle single event', () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(event);
      expect(validator['appliedEvents']).toHaveLength(1);
      expect(validator['appliedEvents'][0]).toEqual(event);
    });
  });

  describe('refresh', () => {
    it('should handle error in getEventStreams', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).eventClient = {
        getEventStreams: () => Promise.reject(new Error('Test error')),
      };

      await expect(validator.refresh()).rejects.toThrow('Test error');
    });

    it('should refresh cached events', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).eventClient = {
        getEventStreams: () => Promise.resolve([event]),
      };

      await validator.refresh();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cachedEvents = await (validator as any).cachedEventsPromise;
      expect(cachedEvents).toEqual([event]);
    });
  });

  describe('reduceOnlyDbEvents', () => {
    it('should reduce only cached events', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      const event1 = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      const event2 = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).cachedEventsPromise = Promise.resolve([
        event1,
        event2,
      ]);

      const result = await validator.testReduceOnlyDbEvents(
        (acc: string[], event) => [...acc, event.data.id],
        [],
      );
      expect(result).toEqual([event1.data.id, event2.data.id]);
    });

    it('should handle error in getEventStreams', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).eventClient = {
        getEventStreams: () => Promise.reject(new Error('Test error')),
      };

      await expect(
        validator.testReduceOnlyDbEvents(
          (acc: string[], event) => [...acc, event.data.id],
          [],
        ),
      ).rejects.toThrow('Test error');
    });

    it('should handle cached events promise rejection', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).cachedEventsPromise = Promise.reject(
        new Error('Cached events error'),
      );

      await expect(
        validator.testReduceOnlyDbEvents(
          (acc: string[], event) => [...acc, event.data.id],
          [],
        ),
      ).rejects.toThrow('Cached events error');
    });
  });

  describe('reduceEvents', () => {
    it('should reduce both cached and applied events', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
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
      (validator as any).cachedEventsPromise = Promise.resolve([
        event1,
        event2,
      ]);
      validator.apply(event3);

      const result = await validator.testReduceEvents(
        (acc: string[], event) => [...acc, event.data.id],
        [],
      );
      expect(result).toEqual([event1.data.id, event2.data.id, event3.data.id]);
    });

    it('should handle error in getEventStreams', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).eventClient = {
        getEventStreams: () => Promise.reject(new Error('Test error')),
      };

      await expect(
        validator.testReduceEvents(
          (acc: string[], event) => [...acc, event.data.id],
          [],
        ),
      ).rejects.toThrow('Test error');
    });

    it('should handle cached events promise rejection', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).cachedEventsPromise = Promise.reject(
        new Error('Cached events error'),
      );

      await expect(
        validator.testReduceEvents(
          (acc: string[], event) => [...acc, event.data.id],
          [],
        ),
      ).rejects.toThrow('Cached events error');
    });
  });

  describe('save', () => {
    it('should return empty array when no events are applied', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      const result = await validator.save();
      expect(result).toEqual([]);
    });

    it('should throw error when cached events are not loaded', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(event);

      await expect(validator.save()).rejects.toThrow();
    });

    it('should throw error when validation fails', async () => {
      const validator = new InvalidTestValidator(client, [
        { types: ['TEST_EVENT'] },
      ]);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(event);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).cachedEventsPromise = Promise.resolve([]);

      await expect(validator.save()).rejects.toThrow('Validation failed');
    });

    it('should throw error when cached events promise rejects', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(event);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).cachedEventsPromise = Promise.reject(
        new Error('Cached events error'),
      );

      await expect(validator.save()).rejects.toThrow('Cached events error');
    });

    it('should throw error when saveEventsWithStreamValidation fails', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(event);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).cachedEventsPromise = Promise.resolve([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).eventClient = {
        saveEventsWithStreamValidation: () =>
          Promise.reject(new Error('Save error')),
      };

      await expect(validator.save()).rejects.toThrow('Save error');
    });

    it('should save events when validation passes', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(event);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).cachedEventsPromise = Promise.resolve([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).eventClient = {
        saveEventsWithStreamValidation: ({
          events,
        }: {
          events: (typeof event)[];
        }) => Promise.resolve(events),
      };

      const result = await validator.save();
      expect(result).toEqual([event]);
    });

    it('should use latest event id from cached events', async () => {
      const validator = new TestValidator(client, [{ types: ['TEST_EVENT'] }]);
      const existingEvent = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
        id: '123',
      };
      const newEvent = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(newEvent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).cachedEventsPromise = Promise.resolve([existingEvent]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).eventClient = {
        saveEventsWithStreamValidation: ({
          events,
          latestEventId,
        }: {
          events: (typeof newEvent)[];
          latestEventId: bigint;
        }) => {
          expect(latestEventId).toBe(123n);
          return Promise.resolve(events);
        },
      };

      const result = await validator.save();
      expect(result).toEqual([newEvent]);
    });
  });
});
