import { describe, it, expect, beforeEach } from 'vitest';
import { createEventClient } from '../../../src';
import { eventUnion, eventInputUnion, eventTypes } from '../events';
import { db } from '../db';
import { MarkItemIncompleteValidator } from './mark-item-incomplete.validator';
import { ulid } from 'ulidx';
import type { Knex } from 'knex';

describe.concurrent('MarkItemIncompleteValidator', () => {
  let knex: Knex;
  let client: ReturnType<
    typeof createEventClient<typeof eventUnion, typeof eventInputUnion>
  >;

  beforeEach(async () => {
    knex = db;
    client = createEventClient(eventUnion, eventInputUnion, knex);
  });

  describe.concurrent('when marking a complete item as incomplete', () => {
    it('should save the event', async () => {
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

      // When marking it as incomplete
      const validator = new MarkItemIncompleteValidator(client, listId, itemId);
      const event = {
        type: eventTypes.ITEM_MARKED_INCOMPLETE,
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

  describe.concurrent('when marking an incomplete item as incomplete', () => {
    it('should throw an error', async () => {
      // Given an incomplete item
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

      // When attempting to mark it as incomplete
      const validator = new MarkItemIncompleteValidator(client, listId, itemId);
      const event = {
        type: eventTypes.ITEM_MARKED_INCOMPLETE,
        data: {
          tenantId,
          listId,
          itemId,
        },
      };

      await validator.apply(event);

      // Then it should throw an error
      await expect(validator.save()).rejects.toThrow('Item is not complete');

      // And no event should be saved
      const events = await client.getEventStream({
        types: [eventTypes.ITEM_MARKED_INCOMPLETE],
        filter: { listId: { eq: listId }, itemId: { eq: itemId } },
      });
      expect(events).toHaveLength(0);
    });
  });

  describe.concurrent('when marking an unknown item as incomplete', () => {
    it('should throw an error', async () => {
      // When attempting to mark an unknown item as incomplete
      const tenantId = ulid();
      const listId = ulid();
      const itemId = ulid();

      const validator = new MarkItemIncompleteValidator(client, listId, itemId);
      const event = {
        type: eventTypes.ITEM_MARKED_INCOMPLETE,
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
        types: [eventTypes.ITEM_MARKED_INCOMPLETE],
        filter: { listId: { eq: listId }, itemId: { eq: itemId } },
      });
      expect(events).toHaveLength(0);
    });
  });

  describe.concurrent('when marking a removed item as incomplete', () => {
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

      // When attempting to mark it as incomplete
      const validator = new MarkItemIncompleteValidator(client, listId, itemId);
      const event = {
        type: eventTypes.ITEM_MARKED_INCOMPLETE,
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
        types: [eventTypes.ITEM_MARKED_INCOMPLETE],
        filter: { listId: { eq: listId }, itemId: { eq: itemId } },
      });
      expect(events).toHaveLength(0);
    });
  });
});
