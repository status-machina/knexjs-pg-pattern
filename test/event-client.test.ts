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
  });
}); 