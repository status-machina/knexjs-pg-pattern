import { describe, it, expect, beforeEach } from 'vitest';
import { createEventClient } from '../../../src';
import { eventUnion, eventInputUnion, eventTypes } from '../events';
import { db } from '../db';
import { CompleteItemValidator } from './complete-item.validator';
import { ulid } from 'ulidx';
import type { Knex } from 'knex';

describe('CompleteItemValidator', () => {
  let knex: Knex;
  let client: ReturnType<typeof createEventClient>;

  beforeEach(async () => {
    knex = db;
    client = createEventClient(eventUnion, eventInputUnion, knex);
  });

  describe('when completing an item that exists in the list', () => {
    it('should save the event', async () => {
      // Given an item in the list
      const listId = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId,
            title: 'Item 1',
          },
        },
      ]);

      // When marking it as complete
      const validator = new CompleteItemValidator(client, listId, itemId);
      const event = {
        type: eventTypes.ITEM_COMPLETED,
        data: {
          listId,
          itemId,
        },
      };

      await validator.apply(event);
      const savedEvents = await validator.save();

      // Then the event should be saved
      expect(savedEvents).toHaveLength(1);
      expect(savedEvents[0]).toMatchObject(event);
    });
  });

  describe('when completing an already complete item', () => {
    it('should throw an error', async () => {
      // Given a complete item
      const listId = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId,
            title: 'Item 1',
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

      // When attempting to mark it as complete again
      const validator = new CompleteItemValidator(client, listId, itemId);
      const event = {
        type: eventTypes.ITEM_COMPLETED,
        data: {
          listId,
          itemId,
        },
      };

      await validator.apply(event);

      // Then it should throw an error
      await expect(validator.save()).rejects.toThrow('Item is not incomplete');

      // And no new event should be saved
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_COMPLETED],
        filter: { listId: { eq: listId }, itemId: { eq: itemId } },
      });
      expect(events).toHaveLength(1);
    });
  });

  describe('when completing an unknown item', () => {
    it('should throw an error', async () => {
      // When attempting to complete an unknown item
      const listId = ulid();
      const itemId = ulid();

      const validator = new CompleteItemValidator(client, listId, itemId);
      const event = {
        type: eventTypes.ITEM_COMPLETED,
        data: {
          listId,
          itemId,
        },
      };

      await validator.apply(event);

      // Then it should throw an error
      await expect(validator.save()).rejects.toThrow(
        'Item is not present in list',
      );

      // And no event should be saved
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_COMPLETED],
        filter: { listId: { eq: listId }, itemId: { eq: itemId } },
      });
      expect(events).toHaveLength(0);
    });
  });

  describe('when completing a removed item', () => {
    it('should throw an error', async () => {
      // Given an item that was added and then removed
      const listId = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId,
            title: 'Item 1',
          },
        },
        {
          type: eventTypes.ITEM_REMOVED,
          data: {
            listId,
            itemId,
          },
        },
      ]);

      // When attempting to complete it
      const validator = new CompleteItemValidator(client, listId, itemId);
      const event = {
        type: eventTypes.ITEM_COMPLETED,
        data: {
          listId,
          itemId,
        },
      };

      await validator.apply(event);

      // Then it should throw an error
      await expect(validator.save()).rejects.toThrow(
        'Item is not present in list',
      );

      // And no event should be saved
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_COMPLETED],
        filter: { listId: { eq: listId }, itemId: { eq: itemId } },
      });
      expect(events).toHaveLength(0);
    });
  });
});
