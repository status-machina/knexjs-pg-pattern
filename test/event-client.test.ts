import { describe, it, expect, beforeEach } from 'vitest';
import { createEventClient } from "../dist";
import { eventUnion, eventInputUnion, eventTypes } from './example/events';
import { db } from './example/db';
import type { Knex } from 'knex';

describe('EventClient', () => {
  let knex: Knex;

  beforeEach(async () => {
    knex = db;
    // Clear events table before each test
    await knex('events').delete();
  });

  describe('saveEvent', () => {
    it('should save and return a valid event', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      
      const eventInput = {
        type: eventTypes.LIST_CREATED,
        data: {
          listId: '123',
          name: 'Test List'
        }
      };

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
      
      const invalidEvent = {
        type: eventTypes.LIST_CREATED,
        data: {
          // missing required name field
          listId: '123'
        }
      };

      await expect(client.saveEvent(invalidEvent)).rejects.toThrow();
    });
  });

  describe('getLatestEvent', () => {
    it('should retrieve the latest event with filters', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      // Create multiple events
      const events = await client.saveEvents<'LIST_CREATED'>([
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: '123',
            name: 'Test List 1'
          }
        },
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId: '456',
            name: 'Test List 2'
          }
        }
      ]);

      const name = events[0].data.name;

      const latestEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: {
          listId: { eq: '456' }
        }
      });

      expect(latestEvent).toBeDefined();
      expect(latestEvent?.data.listId).toBe('456');
    });

    it('should handle IN operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '123', name: 'List 1' }
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '456', name: 'List 2' }
        }
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: {
          listId: { in: ['123', '456'] }
        }
      });

      expect(event).toBeDefined();
      expect(['123', '456']).toContain(event?.data.listId);
    });

    it('should handle numeric comparisons correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId: '123',
            itemId: 'item1',
            priority: 5
          }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: {
            listId: '123',
            itemId: 'item2',
            priority: 10
          }
        }
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: {
          priority: { gt: 7 }
        }
      });

      expect(event).toBeDefined();
      expect(event?.data.itemId).toBe('item2');
      expect(event?.data.priority).toBe(10);
    });

    it('should handle boolean comparisons correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.ITEM_COMPLETION_SET,
          data: {
            listId: '123',
            itemId: 'item1',
            completed: false
          }
        },
        {
          type: eventTypes.ITEM_COMPLETION_SET,
          data: {
            listId: '123',
            itemId: 'item2',
            completed: true
          }
        }
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.ITEM_COMPLETION_SET,
        filter: {
          completed: { eq: true }
        }
      });

      expect(event).toBeDefined();
      expect(event?.data.itemId).toBe('item2');
      expect(event?.data.completed).toBe(true);
    });

    it('should handle string equality operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '123', name: 'List A' }
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '456', name: 'List B' }
        }
      ]);

      const eqEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: { name: { eq: 'List B' } }
      });
      expect(eqEvent?.data.name).toBe('List B');

      const neqEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: { name: { neq: 'List A' } }
      });
      expect(neqEvent?.data.name).toBe('List B');
    });

    it('should handle array operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '123', name: 'List A' }
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '456', name: 'List B' }
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '789', name: 'List C' }
        }
      ]);

      const inEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: { listId: { in: ['123', '456'] } }
      });
      expect(['123', '456']).toContain(inEvent?.data.listId);

      const ninEvent = await client.getLatestEvent({
        type: eventTypes.LIST_CREATED,
        filter: { listId: { nin: ['123', '456'] } }
      });
      expect(ninEvent?.data.listId).toBe('789');
    });

    it('should handle numeric comparison operators correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item1', priority: 5 }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item2', priority: 10 }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item3', priority: 15 }
        }
      ]);

      const gtEvent = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: { priority: { gt: 12 } }
      });
      expect(gtEvent?.data.itemId).toBe('item3');

      const gteEvent = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: { priority: { gte: 10 } }
      });
      expect(['item2', 'item3']).toContain(gteEvent?.data.itemId);

      const ltEvent = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: { priority: { lt: 7 } }
      });
      expect(ltEvent?.data.itemId).toBe('item1');

      const lteEvent = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: { priority: { lte: 10 } }
      });
      expect(['item1', 'item2']).toContain(lteEvent?.data.itemId);
    });

    it('should handle multiple filters correctly', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item1', priority: 5 }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item2', priority: 10 }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '456', itemId: 'item3', priority: 15 }
        }
      ]);

      const event = await client.getLatestEvent({
        type: eventTypes.ITEM_PRIORITY_SET,
        filter: {
          listId: { eq: '123' },
          priority: { gt: 7 }
        }
      });

      expect(event?.data.itemId).toBe('item2');
      expect(event?.data.listId).toBe('123');
      expect(event?.data.priority).toBe(10);
    });
  });

  describe('getEventStream', () => {
    it('should retrieve events of specified types in chronological order', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '123', name: 'List 1' }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item1', priority: 5 }
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '456', name: 'List 2' }
        }
      ]);

      const events = await client.getEventStream<typeof eventTypes.LIST_CREATED>({
        types: [eventTypes.LIST_CREATED]
      });

      expect(events).toHaveLength(2);
      expect(events[0].data.name).toBe('List 1');
      expect(events[1].data.name).toBe('List 2');
    });

    it('should filter events by data fields', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item1', priority: 5 }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item2', priority: 10 }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '456', itemId: 'item3', priority: 15 }
        }
      ]);

      const events = await client.getEventStream<typeof eventTypes.ITEM_PRIORITY_SET>({
        types: [eventTypes.ITEM_PRIORITY_SET],
        filter: {
          listId: { eq: '123' },
          priority: { gt: 7 }
        }
      });

      expect(events).toHaveLength(1);
      expect(events[0].data.itemId).toBe('item2');
      expect(events[0].data.priority).toBe(10);
    });

    it('should handle multiple event types with filters', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '123', name: 'List 1' }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item1', priority: 5 }
        },
        {
          type: eventTypes.ITEM_COMPLETION_SET,
          data: { listId: '123', itemId: 'item1', completed: true }
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '456', name: 'List 2' }
        }
      ]);

      const events = await client.getEventStream<typeof eventTypes.ITEM_PRIORITY_SET | typeof eventTypes.ITEM_COMPLETION_SET>({
        types: [eventTypes.ITEM_PRIORITY_SET, eventTypes.ITEM_COMPLETION_SET],
        filter: {
          listId: { eq: '123' }
        }
      });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe(eventTypes.ITEM_PRIORITY_SET);
      expect(events[1].type).toBe(eventTypes.ITEM_COMPLETION_SET);
    });
  });

  describe('getEventStreams', () => {
    it('should retrieve events from multiple streams in chronological order', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '123', name: 'List 1' }
        },
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item1', priority: 5 }
        },
        {
          type: eventTypes.ITEM_COMPLETION_SET,
          data: { listId: '123', itemId: 'item1', completed: true }
        },
        {
          type: eventTypes.LIST_CREATED,
          data: { listId: '456', name: 'List 2' }
        }
      ]);

      const events = await client.getEventStreams<typeof eventTypes.LIST_CREATED | typeof eventTypes.ITEM_PRIORITY_SET | typeof eventTypes.ITEM_COMPLETION_SET>({
        streams: [
          {
            types: [eventTypes.LIST_CREATED],
            filter: { name: { eq: 'List 1' } }
          },
          {
            types: [eventTypes.ITEM_PRIORITY_SET, eventTypes.ITEM_COMPLETION_SET],
            filter: { listId: { eq: '123' } }
          }
        ]
      });

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe(eventTypes.LIST_CREATED);
      expect((events[0] as { data: { name: string } }).data.name).toBe('List 1');
      expect(events[1].type).toBe(eventTypes.ITEM_PRIORITY_SET);
      expect(events[2].type).toBe(eventTypes.ITEM_COMPLETION_SET);
    });

    it('should not return duplicate events when matched by multiple streams', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);

      await client.saveEvents([
        {
          type: eventTypes.ITEM_PRIORITY_SET,
          data: { listId: '123', itemId: 'item1', priority: 5 }
        },
        {
          type: eventTypes.ITEM_COMPLETION_SET,
          data: { listId: '123', itemId: 'item1', completed: true }
        }
      ]);

      const events = await client.getEventStreams<typeof eventTypes.ITEM_PRIORITY_SET | typeof eventTypes.ITEM_COMPLETION_SET>({
        streams: [
          {
            types: [eventTypes.ITEM_PRIORITY_SET, eventTypes.ITEM_COMPLETION_SET],
            filter: { listId: { eq: '123' } }
          },
          {
            types: [eventTypes.ITEM_PRIORITY_SET],
            filter: { priority: { eq: 5 } }
          }
        ]
      });

      expect(events).toHaveLength(2);
      const eventIds = events.map(e => e.id);
      const uniqueEventIds = [...new Set(eventIds)];
      expect(eventIds).toEqual(uniqueEventIds);
      expect(events[0].type).toBe(eventTypes.ITEM_PRIORITY_SET);
      expect(events[1].type).toBe(eventTypes.ITEM_COMPLETION_SET);
    });
  });
}); 