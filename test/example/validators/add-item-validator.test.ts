import { describe, it, expect, beforeEach } from 'vitest';
import { createEventClient } from '../../../src';
import { eventUnion, eventInputUnion, eventTypes } from '../events';
import { db } from '../db';
import { AddItemValidator } from './add-item-validator';
import { ulid } from 'ulidx';
import type { Knex } from 'knex';

describe('AddItemValidator', () => {
  let knex: Knex;
  let client: ReturnType<typeof createEventClient>;

  beforeEach(async () => {
    knex = db;
    client = createEventClient(eventUnion, eventInputUnion, knex);
  });

  describe('when adding an item with less than three incomplete items', () => {
    it('should save the event', async () => {
      // Given two incomplete items
      const listId = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();
      const itemId3 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId1,
            title: 'Item 1',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId2,
            title: 'Item 2',
          },
        },
      ]);

      // When adding a third item
      const validator = new AddItemValidator(client, listId);
      const event = {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId: itemId3,
          title: 'Item 3',
        },
      };

      await validator.apply(event);
      const savedEvents = await validator.save();

      // Then the event should be saved
      expect(savedEvents).toHaveLength(1);
      expect(savedEvents[0]).toMatchObject(event);
    });
  });

  describe('when adding an item with three incomplete items', () => {
    it('should throw an error', async () => {
      // Given three incomplete items
      const listId = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();
      const itemId3 = ulid();
      const itemId4 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId1,
            title: 'Item 1',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId2,
            title: 'Item 2',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId3,
            title: 'Item 3',
          },
        },
      ]);

      // When attempting to add a fourth item
      const validator = new AddItemValidator(client, listId);
      const event = {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId: itemId4,
          title: 'Item 4',
        },
      };

      await validator.apply(event);

      // Then it should throw an error
      await expect(validator.save()).rejects.toThrow(
        'Incomplete item count is greater than three',
      );

      // And no event should be saved
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_ADDED],
        filter: { listId: { eq: listId }, itemId: { eq: itemId4 } },
      });
      expect(events).toHaveLength(0);
    });
  });

  describe('when adding an item after completing one', () => {
    it('should save the event', async () => {
      // Given three items with one completed
      const listId = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();
      const itemId3 = ulid();
      const itemId4 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId1,
            title: 'Item 1',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId2,
            title: 'Item 2',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId3,
            title: 'Item 3',
          },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: {
            listId,
            itemId: itemId1,
          },
        },
      ]);

      // When adding a new item
      const validator = new AddItemValidator(client, listId);
      const event = {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId: itemId4,
          title: 'Item 4',
        },
      };

      await validator.apply(event);
      const savedEvents = await validator.save();

      // Then the event should be saved
      expect(savedEvents).toHaveLength(1);
      expect(savedEvents[0]).toMatchObject(event);
    });
  });

  describe('when adding an item after removing one', () => {
    it('should save the event', async () => {
      // Given three items with one removed
      const listId = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();
      const itemId3 = ulid();
      const itemId4 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId1,
            title: 'Item 1',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId2,
            title: 'Item 2',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId3,
            title: 'Item 3',
          },
        },
        {
          type: eventTypes.ITEM_REMOVED,
          data: {
            listId,
            itemId: itemId1,
          },
        },
      ]);

      // When adding a new item
      const validator = new AddItemValidator(client, listId);
      const event = {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId: itemId4,
          title: 'Item 4',
        },
      };

      await validator.apply(event);
      const savedEvents = await validator.save();

      // Then the event should be saved
      expect(savedEvents).toHaveLength(1);
      expect(savedEvents[0]).toMatchObject(event);
    });
  });

  describe('when adding an item after marking one as incomplete', () => {
    it('should throw an error', async () => {
      // Given two items with one completed and then marked incomplete
      const listId = ulid();
      const itemId1 = ulid();
      const itemId2 = ulid();
      const itemId3 = ulid();
      const itemId4 = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId1,
            title: 'Item 1',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId2,
            title: 'Item 2',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId: itemId3,
            title: 'Item 3',
          },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: {
            listId,
            itemId: itemId1,
          },
        },
        {
          type: eventTypes.ITEM_MARKED_INCOMPLETE,
          data: {
            listId,
            itemId: itemId1,
          },
        },
      ]);

      // When attempting to add a third item
      const validator = new AddItemValidator(client, listId);
      const event = {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId: itemId4,
          title: 'Item 4',
        },
      };

      await validator.apply(event);

      // Then it should throw an error
      await expect(validator.save()).rejects.toThrow(
        'Incomplete item count is greater than three',
      );

      // And no event should be saved
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_ADDED],
        filter: { listId: { eq: listId }, itemId: { eq: itemId4 } },
      });
      expect(events).toHaveLength(0);
    });
  });
});
