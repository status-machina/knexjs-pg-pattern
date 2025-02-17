import { describe, it, expect, beforeEach } from 'vitest';
import { createEventClient } from '@status-machina/knexjs-pg-pattern';
import {
  eventUnion,
  eventInputUnion,
  eventTypes,
  UserEventInput,
} from './example/events';
import { db } from './example/db';
import { ulid } from 'ulidx';
import type { Knex } from 'knex';

describe.concurrent('EventClient', () => {
  let knex: Knex;

  beforeEach(async () => {
    knex = db;
  });

  describe.concurrent('saveEvent', () => {
    it('should save and return a valid event', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const testId = ulid();

      const eventInput = {
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: `Test List ${testId}`,
          tenantId: testId,
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

  describe.concurrent('getLatestEvent', () => {
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
            tenantId: testId,
          },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId2,
            name: `Test List 2 ${testId}`,
            tenantId: testId,
          },
        },
      ]);

      // This is a test to ensure that the type inference is working
      const _name = events[0].data.name;

      const latestEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: {
          listId: { eq: listId2 },
          tenantId: { eq: testId },
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
          data: { listId: listId1, name: `List 1 ${testId}`, tenantId: testId },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId2,
            name: `List 2 ${testId}`,
            tenantId: testId,
          },
        },
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: {
          listId: { in: [listId1, listId2] },
          tenantId: { eq: testId },
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
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId,
            itemId: itemId1,
            priority: 5,
            tenantId: testId,
          },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId,
            itemId: itemId2,
            priority: 10,
            tenantId: testId,
          },
        },
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: {
          priority: { gt: 7 },
          tenantId: { eq: testId },
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
            tenantId: testId,
          },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: {
            listId,
            itemId,
            tenantId: testId,
          },
        },
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.ITEM_COMPLETED,
        filter: {
          itemId: { eq: itemId },
          tenantId: { eq: testId },
        },
      });

      type ItemCompletedEvent = { data: { itemId: string } };
      expect(event).toBeDefined();
      expect((event as ItemCompletedEvent)?.data.itemId).toBe(itemId);
    });

    it('should handle string equality operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();
      const value1 = `Value A ${testId}`;
      const value2 = `Value B ${testId}`;

      await client.saveEvents([
        {
          type: eventTypes.EXAMPLE_EVENT,
          data: {
            tenantId: testId,
            stringField: value1,
            numberField: 1,
            booleanField: true,
          },
        },
        {
          type: eventTypes.EXAMPLE_EVENT,
          data: {
            tenantId: testId,
            stringField: value2,
            numberField: 2,
            booleanField: false,
          },
        },
      ]);

      const eqEvent = await client.getLatestEvent({
        type: eventTypes.EXAMPLE_EVENT,
        filter: { stringField: { eq: value2 }, tenantId: { eq: testId } },
      });
      expect(eqEvent?.data.stringField).toBe(value2);

      const neqEvent = await client.getLatestEvent({
        type: eventTypes.EXAMPLE_EVENT,
        filter: { stringField: { neq: value1 }, tenantId: { eq: testId } },
      });
      expect(neqEvent?.data.stringField).toBe(value2);
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
          data: { listId: listId1, name: `List A ${testId}`, tenantId: testId },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: `List B ${testId}`, tenantId: testId },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId3, name: `List C ${testId}`, tenantId: testId },
        },
      ]);

      const inEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: {
          listId: { in: [listId1, listId2] },
          tenantId: { eq: testId },
        },
      });
      expect([listId1, listId2]).toContain(inEvent?.data.listId);

      const ninEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: {
          listId: { nin: [listId1, listId2] },
          tenantId: { eq: testId },
        },
      });
      expect(ninEvent?.data.listId).toBe(listId3);
    });

    it('should handle numeric comparison operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.EXAMPLE_EVENT,
          data: {
            tenantId: testId,
            stringField: 'test1',
            numberField: 5,
            booleanField: true,
          },
        },
        {
          type: eventTypes.EXAMPLE_EVENT,
          data: {
            tenantId: testId,
            stringField: 'test2',
            numberField: 10,
            booleanField: false,
          },
        },
        {
          type: eventTypes.EXAMPLE_EVENT,
          data: {
            tenantId: testId,
            stringField: 'test3',
            numberField: 15,
            booleanField: true,
          },
        },
      ]);

      const gtEvent = await client.getLatestEvent({
        type: eventTypes.EXAMPLE_EVENT,
        filter: { numberField: { gt: 12 }, tenantId: { eq: testId } },
      });
      expect(gtEvent?.data.numberField).toBe(15);

      const gteEvent = await client.getLatestEvent({
        type: eventTypes.EXAMPLE_EVENT,
        filter: { numberField: { gte: 10 }, tenantId: { eq: testId } },
      });
      expect([10, 15]).toContain(gteEvent?.data.numberField);

      const ltEvent = await client.getLatestEvent({
        type: eventTypes.EXAMPLE_EVENT,
        filter: { numberField: { lt: 7 }, tenantId: { eq: testId } },
      });
      expect(ltEvent?.data.numberField).toBe(5);

      const lteEvent = await client.getLatestEvent({
        type: eventTypes.EXAMPLE_EVENT,
        filter: { numberField: { lte: 10 }, tenantId: { eq: testId } },
      });
      expect([5, 10]).toContain(lteEvent?.data.numberField);
    });

    it('should handle boolean filters correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.EXAMPLE_EVENT,
          data: {
            tenantId: testId,
            stringField: 'test1',
            numberField: 1,
            booleanField: true,
          },
        },
        {
          type: eventTypes.EXAMPLE_EVENT,
          data: {
            tenantId: testId,
            stringField: 'test2',
            numberField: 2,
            booleanField: false,
          },
        },
      ]);

      const trueEvents = await client.getEventStream({
        types: [eventTypes.EXAMPLE_EVENT],
        filter: {
          booleanField: { eq: true },
          tenantId: { eq: testId },
        },
      });

      expect(trueEvents).toHaveLength(1);
      expect(trueEvents[0].data.booleanField).toBe(true);

      const falseEvents = await client.getEventStream({
        types: [eventTypes.EXAMPLE_EVENT],
        filter: {
          booleanField: { eq: false },
          tenantId: { eq: testId },
        },
      });

      expect(falseEvents).toHaveLength(1);
      expect(falseEvents[0].data.booleanField).toBe(false);
    });

    it('should handle multiple filters correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();
      const itemId3 = ulid();
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId: listId1,
            itemId: itemId1,
            priority: 5,
            tenantId: testId,
          },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId: listId1,
            itemId: itemId2,
            priority: 10,
            tenantId: testId,
          },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId: listId2,
            itemId: itemId3,
            priority: 15,
            tenantId: testId,
          },
        },
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: {
          listId: { eq: listId1 },
          priority: { gt: 7 },
          tenantId: { eq: testId },
        },
      });

      expect(event?.data.itemId).toBe(itemId2);
      expect(event?.data.listId).toBe(listId1);
      expect(event?.data.priority).toBe(10);
    });
  });

  describe.concurrent('getEventStream', () => {
    it('should retrieve events of specified types in chronological order', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();
      const itemId = ulid();
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId1, name: 'List 1', tenantId: testId },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId, priority: 5, tenantId: testId },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: 'List 2', tenantId: testId },
        },
      ]);

      const events = await client.getEventStream<
        typeof eventTypes.LIST_CREATED
      >({
        types: [eventTypes.LIST_CREATED],
        filter: {
          listId: { in: [listId1, listId2] },
          tenantId: { eq: testId },
        },
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
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId: listId1,
            itemId: itemId1,
            priority: 5,
            tenantId: testId,
          },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId: listId1,
            itemId: itemId2,
            priority: 10,
            tenantId: testId,
          },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId: listId2,
            itemId: itemId3,
            priority: 15,
            tenantId: testId,
          },
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
          tenantId: { eq: testId },
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
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId1, name: 'List 1', tenantId: testId },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId, priority: 5, tenantId: testId },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: { listId: listId1, itemId, tenantId: testId },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: 'List 2', tenantId: testId },
        },
      ]);

      const events = await client.getEventStream<
        typeof eventTypes.ITEM_PRIORITY_SET | typeof eventTypes.ITEM_COMPLETED
      >({
        types: [eventTypes.ITEM_PRIORITY_SET, eventTypes.ITEM_COMPLETED],
        filter: {
          listId: { eq: listId1 },
          itemId: { eq: itemId },
          tenantId: { eq: testId },
        },
      });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe(eventTypes.ITEM_PRIORITY_SET);
      expect(events[1].type).toBe(eventTypes.ITEM_COMPLETED);
    });

    it('should reject unknown operators', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();

      type InvalidOperator = { invalid_op: string };
      await expect(
        client.getEventStream({
          types: [eventTypes.LIST_CREATED],
          filter: {
            tenantId: { invalid_op: testId } as unknown as InvalidOperator,
          },
        }),
      ).rejects.toThrow('Unknown operator: invalid_op');
    });

    it('should handle boolean filters correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const itemId = ulid();
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_COMPLETED,
          data: {
            listId,
            itemId,
            tenantId: testId,
          },
        },
        {
          type: eventTypes.ITEM_MARKED_INCOMPLETE,
          data: {
            listId,
            itemId,
            tenantId: testId,
          },
        },
      ]);

      const events = await client.getEventStream({
        types: [eventTypes.ITEM_COMPLETED, eventTypes.ITEM_MARKED_INCOMPLETE],
        filter: {
          listId: { eq: listId },
          itemId: { eq: itemId },
          tenantId: { eq: testId },
        },
      });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe(eventTypes.ITEM_COMPLETED);
      expect(events[1].type).toBe(eventTypes.ITEM_MARKED_INCOMPLETE);
    });
  });

  describe.concurrent('getEventStreams', () => {
    it('should retrieve events from multiple streams in chronological order', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();
      const itemId = ulid();
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId1, name: 'List 1', tenantId: testId },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: listId1, itemId, priority: 5, tenantId: testId },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: { listId: listId1, itemId, tenantId: testId },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: listId2, name: 'List 2', tenantId: testId },
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
            filter: { listId: { eq: listId1 }, tenantId: { eq: testId } },
          },
          {
            types: [eventTypes.ITEM_PRIORITY_SET, eventTypes.ITEM_COMPLETED],
            filter: {
              listId: { eq: listId1 },
              itemId: { eq: itemId },
              tenantId: { eq: testId },
            },
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
      const testId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId, itemId, priority: 5, tenantId: testId },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: { listId, itemId, tenantId: testId },
        },
      ]);

      const events = await client.getEventStreams<
        typeof eventTypes.ITEM_PRIORITY_SET | typeof eventTypes.ITEM_COMPLETED
      >({
        streams: [
          {
            types: [eventTypes.ITEM_PRIORITY_SET, eventTypes.ITEM_COMPLETED],
            filter: {
              listId: { eq: listId },
              itemId: { eq: itemId },
              tenantId: { eq: testId },
            },
          },
          {
            types: [eventTypes.ITEM_PRIORITY_SET],
            filter: {
              listId: { eq: listId },
              itemId: { eq: itemId },
              priority: { eq: 5 },
              tenantId: { eq: testId },
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

    it('should only return events after the specified afterId', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const itemId = ulid();
      const testId = ulid();

      const events = await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId, name: 'List 1', tenantId: testId },
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId, itemId, priority: 5, tenantId: testId },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: { listId, itemId, tenantId: testId },
        },
      ]);

      const afterSecondEvent = await client.getEventStreams({
        streams: [
          {
            types: [
              eventTypes.LIST_CREATED,
              eventTypes.ITEM_PRIORITY_SET,
              eventTypes.ITEM_COMPLETED,
            ],
            filter: { listId: { eq: listId }, tenantId: { eq: testId } },
          },
        ],
        afterId: events[1].id,
      });

      expect(afterSecondEvent).toHaveLength(1);
      expect(afterSecondEvent[0].type).toBe(eventTypes.ITEM_COMPLETED);

      const afterFirstEvent = await client.getEventStreams({
        streams: [
          {
            types: [
              eventTypes.LIST_CREATED,
              eventTypes.ITEM_PRIORITY_SET,
              eventTypes.ITEM_COMPLETED,
            ],
            filter: { listId: { eq: listId }, tenantId: { eq: testId } },
          },
        ],
        afterId: events[0].id,
      });

      expect(afterFirstEvent).toHaveLength(2);
      expect(afterFirstEvent[0].type).toBe(eventTypes.ITEM_PRIORITY_SET);
      expect(afterFirstEvent[1].type).toBe(eventTypes.ITEM_COMPLETED);
    });
  });

  describe.concurrent('saveEventWithStreamValidation', () => {
    it('should save event when no newer events exist', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const itemId = ulid();
      const testId = ulid();

      const [event1] = await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId, name: 'List 1', tenantId: testId },
        },
      ]);

      await client.saveEventWithStreamValidation({
        event: {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId, itemId, priority: 5, tenantId: testId },
        },
        latestEventId: event1.id,
        streams: [
          {
            types: [eventTypes.LIST_CREATED, eventTypes.ITEM_PRIORITY_SET],
            filter: {
              listId: { eq: listId },
              tenantId: { eq: testId },
            },
          },
        ],
      });

      // Verify the event was saved
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_PRIORITY_SET],
        filter: {
          listId: { eq: listId },
          itemId: { eq: itemId },
          tenantId: { eq: testId },
        },
      });
      expect(events).toHaveLength(1);
      expect(events[0].data.priority).toBe(5);
    });

    it('should reject save when newer events exist', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const itemId = ulid();
      const testId = ulid();

      const [event1] = await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId, name: 'List 1', tenantId: testId },
        },
      ]);

      // Add a newer event
      await client.saveEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        data: { listId, itemId, priority: 10, tenantId: testId },
      });

      // Try to save with old event id
      await expect(
        client.saveEventWithStreamValidation({
          event: {
            type: eventTypes.ITEM_PRIORITY_SET,
            data: { listId, itemId, priority: 5, tenantId: testId },
          },
          latestEventId: event1.id,
          streams: [
            {
              types: [eventTypes.LIST_CREATED, eventTypes.ITEM_PRIORITY_SET],
              filter: {
                listId: { eq: listId },
                tenantId: { eq: testId },
              },
            },
          ],
        }),
      ).rejects.toThrow('Concurrent modification detected');

      // Verify only the original events exist
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_PRIORITY_SET],
        filter: {
          listId: { eq: listId },
          itemId: { eq: itemId },
          tenantId: { eq: testId },
        },
      });
      expect(events).toHaveLength(1);
      expect(events[0].data.priority).toBe(10);
    });
  });

  describe.concurrent('saveEventsWithStreamValidation', () => {
    it('should save multiple events when no newer events exist', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId1 = ulid();
      const listId2 = ulid();
      const testId = ulid();

      const events = [
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId1,
            name: 'Test List 1',
            tenantId: testId,
          },
        },
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId2,
            name: 'Test List 2',
            tenantId: testId,
          },
        },
      ];

      const savedEvents = await client.saveEventsWithStreamValidation({
        events,
        latestEventId: 0n,
        streams: [
          {
            types: [eventTypes.LIST_CREATED],
            filter: {
              listId: { in: [listId1, listId2] },
              tenantId: { eq: testId },
            },
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
      const testId = ulid();

      // Create an initial event
      const _initialEvent = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId: listId1,
          name: 'Test List',
          tenantId: testId,
        },
      });

      const events = [
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: listId2,
            name: 'Test List 2',
            tenantId: testId,
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
              filter: {
                listId: { in: [listId1, listId2] },
                tenantId: { eq: testId },
              },
            },
          ],
        }),
      ).rejects.toThrow('Concurrent modification detected');
    });
  });

  describe.concurrent('saveEvents', () => {
    it('should handle database errors', async () => {
      type MockTransaction = {
        (tableName: string): {
          insert: (data: unknown[]) => {
            returning: (fields: string[]) => Promise<never>;
          };
        };
      };
      type TransactionCallback = (trx: MockTransaction) => Promise<unknown>;
      const mockKnex = {
        transaction: (fn: TransactionCallback) =>
          fn((_tableName: string) => ({
            insert: () => ({
              returning: () => Promise.reject(new Error('Database error')),
            }),
          })),
      } as unknown as Knex;
      const client = createEventClient(eventUnion, eventInputUnion, mockKnex);
      const testId = ulid();

      await expect(
        client.saveEvents([
          {
            type: eventTypes.EXAMPLE_EVENT,
            data: {
              tenantId: testId,
              stringField: 'test',
              numberField: 1,
              booleanField: true,
            },
          },
        ]),
      ).rejects.toThrow('Database error');
    });

    it('should reject invalid event type', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();

      type InvalidEvent = { type: string; data: { tenantId: string } };
      await expect(
        client.saveEvents([
          {
            type: 'INVALID_EVENT_TYPE',
            data: {
              tenantId: testId,
            },
          } as InvalidEvent,
        ]),
      ).rejects.toThrow();
    });

    it('should reject invalid event data structure', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();

      type InvalidExampleEvent = {
        type: typeof eventTypes.EXAMPLE_EVENT;
        data: { tenantId: string };
      };
      await expect(
        client.saveEvents([
          {
            type: eventTypes.EXAMPLE_EVENT,
            data: {
              tenantId: testId,
            },
          } as InvalidExampleEvent,
        ]),
      ).rejects.toThrow();
    });
  });
});

describe.concurrent('event-client projections', () => {
  const client = createEventClient(eventUnion, eventInputUnion, db);

  describe.concurrent('saveProjection', () => {
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

  describe.concurrent('forceUpdateProjection', () => {
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

  describe.concurrent('conditionalUpdateProjection', () => {
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

  describe.concurrent('getProjection', () => {
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

  describe.concurrent('queryProjections', () => {
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
