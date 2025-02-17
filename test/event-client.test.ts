import { describe, it, expect, beforeEach } from 'vitest';
import { createEventClient } from '../dist';
import {
  eventUnion,
  eventInputUnion,
  eventTypes,
  UserEventInput,
} from './example/events';
import { db } from './example/db';
import { ulid } from 'ulidx';
import type { Knex } from 'knex';

describe('EventClient', () => {
  let knex: Knex;

  beforeEach(async () => {
    knex = db;
  });

  describe('saveEvent', () => {
    it('should save and return a valid event', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const testId = ulid();

      const eventInput = {
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: `Test List ${testId}`,
        },
      };

      // This should be a type error
      const savedEvent = await client.saveEvent(eventInput);

      expect(savedEvent).toMatchObject({
        type: eventInput.type,
        data: eventInput.data,
      });
      expect(savedEvent.id).toBeDefined();
      expect(typeof savedEvent.id).toBe('bigint');
      expect(savedEvent.created_at).toBeDefined();
      expect(savedEvent.updated_at).toBeDefined();
    });

    it('should reject invalid event data', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();

      const invalidEvent = {
        type: eventTypes.LIST_CREATED,
        data: {
          // missing required name field
          listId,
        },
      };

      await expect(
        client.saveEvent(invalidEvent as unknown as UserEventInput),
      ).rejects.toThrow();
    });
  });

  describe('getLatestEvent', () => {
    it('should retrieve the latest event with filters', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();
      const listId1 = ulid();
      const listId2 = ulid();

      // Create multiple events
      const events = await client.saveEvents<'LIST_CREATED'>([
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId1,
            name: `Test List 1 ${testId}`,
          },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId2,
            name: `Test List 2 ${testId}`,
          },
        },
      ]);

      // This is a test to ensure that the type inference is working
      const _name = events[0].data.name;

      const latestEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: {
          listId: { eq: listId2 },
        },
      });

      expect(latestEvent).toBeDefined();
      expect(latestEvent?.data.listId).toBe(listId2);
    });

    it('should handle IN operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();
      const listId1 = ulid();
      const listId2 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId1, name: `List 1 ${testId}` },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: `List 2 ${testId}` },
        },
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: {
          listId: { in: [listId1, listId2] },
        },
      });

      expect(event).toBeDefined();
      expect([listId1, listId2]).toContain(event?.data.listId);
    });

    it('should handle numeric comparisons correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId,
            itemId: itemId1,
            priority: 5,
          },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId,
            itemId: itemId2,
            priority: 10,
          },
        },
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: {
          priority: { gt: 7 },
        },
      });

      expect(event).toBeDefined();
      expect(event?.data.itemId).toBe(itemId2);
      expect(event?.data.priority).toBe(10);
    });

    it('should handle boolean comparisons correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();
      const listId = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId,
            title: `Item 1 ${testId}`,
          },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: {
            listId,
            itemId,
          },
        },
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.ITEM_COMPLETED,
        filter: {
          itemId: { eq: itemId },
        },
      });

      type ItemCompletedEvent = { data: { itemId: string } };
      expect(event).toBeDefined();
      expect((event as ItemCompletedEvent)?.data.itemId).toBe(itemId);
    });

    it('should handle string equality operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();
      const listId1 = ulid();
      const listId2 = ulid();
      const name1 = `List A ${testId}`;
      const name2 = `List B ${testId}`;

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId1, name: name1 },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: name2 },
        },
      ]);

      const eqEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: { name: { eq: name2 } },
      });
      expect(eqEvent?.data.name).toBe(name2);

      const neqEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: { name: { neq: name1 } },
      });
      expect(neqEvent?.data.name).toBe(name2);
    });

    it('should handle array operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();
      const listId1 = ulid();
      const listId2 = ulid();
      const listId3 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId1, name: `List A ${testId}` },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: `List B ${testId}` },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId3, name: `List C ${testId}` },
        },
      ]);

      const inEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: { listId: { in: [listId1, listId2] } },
      });
      expect([listId1, listId2]).toContain(inEvent?.data.listId);

      const ninEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: { listId: { nin: [listId1, listId2] } },
      });
      expect(ninEvent?.data.listId).toBe(listId3);
    });

    it('should handle numeric comparison operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();
      const itemId3 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId, itemId: itemId1, priority: 5 },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId, itemId: itemId2, priority: 10 },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId, itemId: itemId3, priority: 15 },
        },
      ]);

      const gtEvent = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: { priority: { gt: 12 } },
      });
      expect(gtEvent?.data.itemId).toBe(itemId3);

      const gteEvent = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: { priority: { gte: 10 } },
      });
      expect([itemId2, itemId3]).toContain(gteEvent?.data.itemId);

      const ltEvent = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: { priority: { lt: 7 } },
      });
      expect(ltEvent?.data.itemId).toBe(itemId1);

      const lteEvent = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: { priority: { lte: 10 } },
      });
      expect([itemId1, itemId2]).toContain(lteEvent?.data.itemId);
    });

    it('should handle multiple filters correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();
      const itemId3 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId: itemId1, priority: 5 },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId: itemId2, priority: 10 },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId2, itemId: itemId3, priority: 15 },
        },
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: {
          listId: { eq: listId1 },
          priority: { gt: 7 },
        },
      });

      expect(event?.data.itemId).toBe(itemId2);
      expect(event?.data.listId).toBe(listId1);
      expect(event?.data.priority).toBe(10);
    });
  });

  describe('getEventStream', () => {
    it('should retrieve events of specified types in chronological order', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId1, name: 'List 1' },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId, priority: 5 },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: 'List 2' },
        },
      ]);

      const events = await client.getEventStream<
        typeof eventTypes.LIST_CREATED
      >({
        types: [eventTypes.LIST_CREATED],
        filter: { listId: { in: [listId1, listId2] } },
      });

      expect(events).toHaveLength(2);
      expect(events[0].data.name).toBe('List 1');
      expect(events[1].data.name).toBe('List 2');
    });

    it('should filter events by data fields', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();
      const itemId3 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId: itemId1, priority: 5 },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId: itemId2, priority: 10 },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId2, itemId: itemId3, priority: 15 },
        },
      ]);

      const events = await client.getEventStream<
        typeof eventTypes.ITEM_PRIORITY_SET
      >({
        types: [eventTypes.ITEM_PRIORITY_SET],
        filter: {
          listId: { eq: listId1 },
          priority: { gt: 7 },
          itemId: { in: [itemId1, itemId2] },
        },
      });

      expect(events).toHaveLength(1);
      expect(events[0].data.itemId).toBe(itemId2);
      expect(events[0].data.priority).toBe(10);
    });

    it('should handle multiple event types with filters', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId1, name: 'List 1' },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId, priority: 5 },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: { listId: listId1, itemId },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: 'List 2' },
        },
      ]);

      const events = await client.getEventStream<
        typeof eventTypes.ITEM_PRIORITY_SET | typeof eventTypes.ITEM_COMPLETED
      >({
        types: [eventTypes.ITEM_PRIORITY_SET, eventTypes.ITEM_COMPLETED],
        filter: {
          listId: { eq: listId1 },
          itemId: { eq: itemId },
        },
      });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe(eventTypes.ITEM_PRIORITY_SET);
      expect(events[1].type).toBe(eventTypes.ITEM_COMPLETED);
    });
  });

  describe('getEventStreams', () => {
    it('should retrieve events from multiple streams in chronological order', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId1, name: 'List 1' },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId, priority: 5 },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: { listId: listId1, itemId },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: 'List 2' },
        },
      ]);

      const events = await client.getEventStreams<
        | typeof eventTypes.LIST_CREATED
        | typeof eventTypes.ITEM_PRIORITY_SET
        | typeof eventTypes.ITEM_COMPLETED
      >({
        streams: [
          {
            types: [eventTypes.LIST_CREATED],
            filter: { listId: { eq: listId1 } },
          },
          {
            types: [eventTypes.ITEM_PRIORITY_SET, eventTypes.ITEM_COMPLETED],
            filter: { listId: { eq: listId1 }, itemId: { eq: itemId } },
          },
        ],
      });

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe(eventTypes.LIST_CREATED);
      expect((events[0] as { data: { name: string } }).data.name).toBe(
        'List 1',
      );
      expect(events[1].type).toBe(eventTypes.ITEM_PRIORITY_SET);
      expect(events[2].type).toBe(eventTypes.ITEM_COMPLETED);
    });

    it('should not return duplicate events when matched by multiple streams', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId, itemId, priority: 5 },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: { listId, itemId },
        },
      ]);

      const events = await client.getEventStreams<
        typeof eventTypes.ITEM_PRIORITY_SET | typeof eventTypes.ITEM_COMPLETED
      >({
        streams: [
          {
            types: [eventTypes.ITEM_PRIORITY_SET, eventTypes.ITEM_COMPLETED],
            filter: { listId: { eq: listId }, itemId: { eq: itemId } },
          },
          {
            types: [eventTypes.ITEM_PRIORITY_SET],
            filter: {
              listId: { eq: listId },
              itemId: { eq: itemId },
              priority: { eq: 5 },
            },
          },
        ],
      });

      expect(events).toHaveLength(2);
      const eventIds = events.map((e) => e.id);
      const uniqueEventIds = [...new Set(eventIds)];
      expect(eventIds).toEqual(uniqueEventIds);
      expect(events[0].type).toBe(eventTypes.ITEM_PRIORITY_SET);
      expect(events[1].type).toBe(eventTypes.ITEM_COMPLETED);
    });
  });

  describe('saveEventWithStreamValidation', () => {
    it('should save event when no newer events exist', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const itemId = ulid();

      const [event1] = await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId, name: 'List 1' },
        },
      ]);

      await client.saveEventWithStreamValidation({
        event: {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId, itemId, priority: 5 },
        },
        latestEventId: event1.id,
        streams: [
          {
            types: [eventTypes.LIST_CREATED, eventTypes.ITEM_PRIORITY_SET],
            filter: { listId: { eq: listId } },
          },
        ],
      });

      // Verify the event was saved
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_PRIORITY_SET],
        filter: { listId: { eq: listId }, itemId: { eq: itemId } },
      });
      expect(events).toHaveLength(1);
      expect(events[0].data.priority).toBe(5);
    });

    it('should reject save when newer events exist', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const itemId = ulid();

      const [event1] = await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId, name: 'List 1' },
        },
      ]);

      // Add a newer event
      await client.saveEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        data: { listId, itemId, priority: 10 },
      });

      // Try to save with old event id
      await expect(
        client.saveEventWithStreamValidation({
          event: {
            type: eventTypes.ITEM_PRIORITY_SET,
            data: { listId, itemId, priority: 5 },
          },
          latestEventId: event1.id,
          streams: [
            {
              types: [eventTypes.LIST_CREATED, eventTypes.ITEM_PRIORITY_SET],
              filter: { listId: { eq: listId } },
            },
          ],
        }),
      ).rejects.toThrow('Concurrent modification detected');

      // Verify only the original events exist
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_PRIORITY_SET],
        filter: { listId: { eq: listId }, itemId: { eq: itemId } },
      });
      expect(events).toHaveLength(1);
      expect(events[0].data.priority).toBe(10);
    });
  });

  describe('saveEventsWithStreamValidation', () => {
    it('should save multiple events when no newer events exist', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();

      const events = [
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId1,
            name: 'Test List 1',
          },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId2,
            name: 'Test List 2',
          },
        },
      ];

      const savedEvents = await client.saveEventsWithStreamValidation({
        events,
        latestEventId: 0n,
        streams: [
          {
            types: [eventTypes.LIST_CREATED],
            filter: { listId: { in: [listId1, listId2] } },
          },
        ],
      });

      expect(savedEvents).toHaveLength(2);
      expect(savedEvents[0]).toMatchObject({
        type: events[0].type,
        data: events[0].data,
      });
      expect(savedEvents[1]).toMatchObject({
        type: events[1].type,
        data: events[1].data,
      });
    });

    it('should reject when newer events exist', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();

      // Create an initial event
      const _initialEvent = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId: listId1,
          name: 'Test List',
        },
      });

      const events = [
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId2,
            name: 'Test List 2',
          },
        },
      ];

      // Try to save with an old latestEventId
      await expect(
        client.saveEventsWithStreamValidation({
          events,
          latestEventId: 0n,
          streams: [
            {
              types: [eventTypes.LIST_CREATED],
              filter: { listId: { in: [listId1, listId2] } },
            },
          ],
        }),
      ).rejects.toThrow('Concurrent modification detected');
    });
  });
});

describe('event-client projections', () => {
  const client = createEventClient(eventUnion, eventInputUnion, db);

  describe('saveProjection', () => {
    it('should save a new projection', async () => {
      const projectionId = ulid();
      const eventId = 123n;

      await client.saveProjection({
        type: 'test-projection',
        id: projectionId,
        data: { count: 1 },
        eventId,
      });

      const result = await client.getProjection({
        type: 'test-projection',
        id: projectionId,
      });

      expect(result).toMatchObject({
        type: 'test-projection',
        id: projectionId,
        data: { count: 1 },
        lastEventId: eventId,
      });
    });

    it('should update an existing projection', async () => {
      const projectionId = ulid();
      const eventId1 = 123n;
      const eventId2 = 124n;

      await client.saveProjection({
        type: 'test-projection',
        id: projectionId,
        data: { count: 1 },
        eventId: eventId1,
      });

      await client.saveProjection({
        type: 'test-projection',
        id: projectionId,
        data: { count: 2 },
        eventId: eventId2,
      });

      const result = await client.getProjection({
        type: 'test-projection',
        id: projectionId,
      });

      expect(result).toMatchObject({
        type: 'test-projection',
        id: projectionId,
        data: { count: 2 },
        lastEventId: eventId2,
      });
    });
  });

  describe('forceUpdateProjection', () => {
    it('should update projection data without changing last_event_id', async () => {
      const projectionId = ulid();
      const eventId = 123n;

      await client.saveProjection({
        type: 'test-projection',
        id: projectionId,
        data: { count: 1 },
        eventId,
      });

      await client.forceUpdateProjection({
        type: 'test-projection',
        id: projectionId,
        data: { count: 2 },
      });

      const result = await client.getProjection({
        type: 'test-projection',
        id: projectionId,
      });

      expect(result).toMatchObject({
        type: 'test-projection',
        id: projectionId,
        data: { count: 2 },
        lastEventId: eventId,
      });
    });
  });

  describe('conditionalUpdateProjection', () => {
    it('should update when new event id is higher', async () => {
      const projectionId = ulid();
      const eventId1 = 123n;
      const eventId2 = 124n;

      await client.saveProjection({
        type: 'test-projection',
        id: projectionId,
        data: { count: 1 },
        eventId: eventId1,
      });

      await client.conditionalUpdateProjection({
        type: 'test-projection',
        id: projectionId,
        data: { count: 2 },
        eventId: eventId2,
      });

      const result = await client.getProjection({
        type: 'test-projection',
        id: projectionId,
      });

      expect(result).toMatchObject({
        type: 'test-projection',
        id: projectionId,
        data: { count: 2 },
        lastEventId: eventId2,
      });
    });

    it('should throw when new event id is lower', async () => {
      const projectionId = ulid();
      const eventId1 = 123n;
      const eventId2 = 124n;

      await client.saveProjection({
        type: 'test-projection',
        id: projectionId,
        data: { count: 1 },
        eventId: eventId2, // Using higher ID first
      });

      await expect(
        client.conditionalUpdateProjection({
          type: 'test-projection',
          id: projectionId,
          data: { count: 2 },
          eventId: eventId1, // Using lower ID
        }),
      ).rejects.toThrow('Concurrent modification detected');

      const result = await client.getProjection({
        type: 'test-projection',
        id: projectionId,
      });

      expect(result).toMatchObject({
        type: 'test-projection',
        id: projectionId,
        data: { count: 1 },
        lastEventId: eventId2,
      });
    });
  });

  describe('getProjection', () => {
    it('should return null when projection does not exist', async () => {
      const projectionId = ulid();

      const result = await client.getProjection({
        type: 'test-projection',
        id: projectionId,
      });

      expect(result).toBeNull();
    });

    it('should return projection when it exists', async () => {
      const projectionId = ulid();
      const eventId = 123n;

      await client.saveProjection({
        type: 'test-projection',
        id: projectionId,
        data: { count: 1 },
        eventId,
      });

      const result = await client.getProjection({
        type: 'test-projection',
        id: projectionId,
      });

      expect(result).toMatchObject({
        type: 'test-projection',
        id: projectionId,
        data: { count: 1 },
        lastEventId: eventId,
      });
    });
  });

  describe('queryProjections', () => {
    it('should find projections by type', async () => {
      const testId = ulid();
      const projectionId1 = ulid();
      const projectionId2 = ulid();
      const eventId1 = 123n;
      const eventId2 = 124n;

      await client.saveProjection({
        type: `test-projection-type-${testId}`,
        id: projectionId1,
        data: { count: 1 },
        eventId: eventId1,
      });

      await client.saveProjection({
        type: `test-projection-other-${testId}`,
        id: projectionId2,
        data: { count: 2 },
        eventId: eventId2,
      });

      const results = await client.queryProjections({
        type: `test-projection-type-${testId}`,
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: `test-projection-type-${testId}`,
        id: projectionId1,
        data: { count: 1 },
      });
    });

    it('should filter by data fields', async () => {
      const testId = ulid();
      const projectionId1 = ulid();
      const projectionId2 = ulid();
      const eventId1 = 123n;
      const eventId2 = 124n;

      await client.saveProjection({
        type: `test-projection-status-${testId}`,
        id: projectionId1,
        data: { count: 1, status: 'active' },
        eventId: eventId1,
      });

      await client.saveProjection({
        type: `test-projection-status-${testId}`,
        id: projectionId2,
        data: { count: 2, status: 'inactive' },
        eventId: eventId2,
      });

      const results = await client.queryProjections({
        type: `test-projection-status-${testId}`,
        filter: { status: { eq: 'active' } },
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: `test-projection-status-${testId}`,
        id: projectionId1,
        data: { count: 1, status: 'active' },
      });
    });

    it('should filter by numeric fields', async () => {
      const testId = ulid();
      const projectionId1 = ulid();
      const projectionId2 = ulid();
      const eventId1 = 123n;
      const eventId2 = 124n;

      await client.saveProjection({
        type: `test-projection-numeric-${testId}`,
        id: projectionId1,
        data: { value: 1 },
        eventId: eventId1,
      });

      await client.saveProjection({
        type: `test-projection-numeric-${testId}`,
        id: projectionId2,
        data: { value: 2 },
        eventId: eventId2,
      });

      const results = await client.queryProjections({
        type: `test-projection-numeric-${testId}`,
        filter: { value: { eq: 1 } },
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: `test-projection-numeric-${testId}`,
        id: projectionId1,
        data: { value: 1 },
      });
    });
  });
});
