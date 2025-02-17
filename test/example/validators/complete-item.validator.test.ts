import { describe, it, expect, beforeEach } from 'vitest';
import { createEventClient } from '@status-machina/knexjs-pg-pattern';
import { eventUnion, eventInputUnion, eventTypes } from '../events';
import { db } from '../db';
import { CompleteItemValidator } from './complete-item.validator';
import { ulid } from 'ulidx';
import type { Knex } from 'knex';

describe.concurrent('CompleteItemValidator', () => {
  let knex: Knex;
  let client: ReturnType<
    typeof createEventClient<typeof eventUnion, typeof eventInputUnion>
  >;

  beforeEach(async () => {
    knex = db;
    client = createEventClient(eventUnion, eventInputUnion, knex);
  });

  describe.concurrent('when completing an item that exists in the list', () => {
    it('should save the event', async () => {
      // Given an item in the list
      const tenantId = ulid();
      const listId = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            tenantId,
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
          tenantId,
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

  describe.concurrent('when completing an already complete item', () => {
    it('should throw an error', async () => {
      // Given a complete item
      const tenantId = ulid();
      const listId = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            tenantId,
            listId,
            itemId,
            title: 'Item 1',
          },
        },
        {
          type: eventTypes.ITEM_COMPLETED,
          data: {
            tenantId,
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
          tenantId,
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

  describe.concurrent('when completing an unknown item', () => {
    it('should throw an error', async () => {
      // When attempting to complete an unknown item
      const tenantId = ulid();
      const listId = ulid();
      const itemId = ulid();

      const validator = new CompleteItemValidator(client, listId, itemId);
      const event = {
        type: eventTypes.ITEM_COMPLETED,
        data: {
          tenantId,
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

  describe.concurrent('when completing a removed item', () => {
    it('should throw an error', async () => {
      // Given an item that was added and then removed
      const tenantId = ulid();
      const listId = ulid();
      const itemId = ulid();

      await client.saveEvents([
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            tenantId,
            listId,
            itemId,
            title: 'Item 1',
          },
        },
        {
          type: eventTypes.ITEM_REMOVED,
          data: {
            tenantId,
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
          tenantId,
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
