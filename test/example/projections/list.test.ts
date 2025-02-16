import { describe, it, expect, beforeEach } from 'vitest';
import { createEventClient } from '../../../dist';
import { eventUnion, eventInputUnion, eventTypes } from '../events';
import { db } from '../db';
import { ListProjection } from './list';
import { ulid } from 'ulidx';

describe('ListProjection', () => {
  beforeEach(async () => {
    // No setup needed at this level
  });

  it('should handle list creation and item addition', async () => {
    const listId = ulid();
    const itemId = ulid();
    const client = createEventClient(eventUnion, eventInputUnion, db);
    await client.saveEvents([
      {
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: 'Test List',
        },
      },
      {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId,
          title: 'Test Item',
        },
      },
    ]);

    const projection = new ListProjection(client, listId);
    const json = await projection.asJson();

    expect(json).toMatchObject({
      listId,
      name: 'Test List',
      completedItems: [],
      incompleteItems: [
        {
          id: itemId,
          text: 'Test Item',
        },
      ],
      removedItems: [],
    });
  });

  it('should handle item completion', async () => {
    const listId = ulid();
    const itemId = ulid();
    const client = createEventClient(eventUnion, eventInputUnion, db);
    await client.saveEvents([
      {
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: 'Test List',
        },
      },
      {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId,
          title: 'Test Item',
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

    const projection = new ListProjection(client, listId);
    const json = await projection.asJson();

    expect(json).toMatchObject({
      listId,
      name: 'Test List',
      completedItems: [
        {
          id: itemId,
          text: 'Test Item',
        },
      ],
      incompleteItems: [],
      removedItems: [],
    });
  });

  it('should handle marking item as incomplete', async () => {
    const listId = ulid();
    const itemId = ulid();
    const client = createEventClient(eventUnion, eventInputUnion, db);
    await client.saveEvents([
      {
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: 'Test List',
        },
      },
      {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId,
          title: 'Test Item',
        },
      },
      {
        type: eventTypes.ITEM_COMPLETED,
        data: {
          listId,
          itemId,
        },
      },
      {
        type: eventTypes.ITEM_MARKED_INCOMPLETE,
        data: {
          listId,
          itemId,
        },
      },
    ]);

    const projection = new ListProjection(client, listId);
    const json = await projection.asJson();

    expect(json).toMatchObject({
      listId,
      name: 'Test List',
      completedItems: [],
      incompleteItems: [
        {
          id: itemId,
          text: 'Test Item',
        },
      ],
      removedItems: [],
    });
  });

  it('should handle item removal', async () => {
    const listId = ulid();
    const itemId = ulid();
    const client = createEventClient(eventUnion, eventInputUnion, db);
    await client.saveEvents([
      {
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: 'Test List',
        },
      },
      {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId,
          title: 'Test Item',
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

    const projection = new ListProjection(client, listId);
    const json = await projection.asJson();

    expect(json).toMatchObject({
      listId,
      name: 'Test List',
      completedItems: [],
      incompleteItems: [],
      removedItems: [
        {
          id: itemId,
          text: 'Test Item',
        },
      ],
    });
  });

  it('should handle removing a completed item', async () => {
    const listId = ulid();
    const itemId = ulid();
    const client = createEventClient(eventUnion, eventInputUnion, db);
    await client.saveEvents([
      {
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: 'Test List',
        },
      },
      {
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId,
          title: 'Test Item',
        },
      },
      {
        type: eventTypes.ITEM_COMPLETED,
        data: {
          listId,
          itemId,
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

    const projection = new ListProjection(client, listId);
    const json = await projection.asJson();

    expect(json).toMatchObject({
      listId,
      name: 'Test List',
      completedItems: [],
      incompleteItems: [],
      removedItems: [
        {
          id: itemId,
          text: 'Test Item',
        },
      ],
    });
  });

  describe('with existing projection', () => {
    it('should load and use existing projection', async () => {
      const listId = ulid();
      const itemId = ulid();
      const client = createEventClient(eventUnion, eventInputUnion, db);
      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId,
            name: 'Test List',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId,
            title: 'Test Item',
          },
        },
      ]);

      const projection = new ListProjection(client, listId);
      await projection.save();

      const newItemId = ulid();
      await client.saveEvent({
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId: newItemId,
          title: 'New Item',
        },
      });

      const projectionWithExisting = new ListProjection(client, listId, {
        loadExisting: true,
      });
      const json = await projectionWithExisting.asJson();

      expect(json).toMatchObject({
        listId,
        name: 'Test List',
        completedItems: [],
        incompleteItems: [
          {
            id: itemId,
            text: 'Test Item',
          },
          {
            id: newItemId,
            text: 'New Item',
          },
        ],
        removedItems: [],
      });
    });

    it('should only load events after the last event in projection', async () => {
      const listId = ulid();
      const itemId = ulid();
      const client = createEventClient(eventUnion, eventInputUnion, db);
      await client.saveEvents([
        {
          type: eventTypes.LIST_CREATED,
          data: {
            listId,
            name: 'Test List',
          },
        },
        {
          type: eventTypes.ITEM_ADDED,
          data: {
            listId,
            itemId,
            title: 'Test Item',
          },
        },
      ]);

      const projection = new ListProjection(client, listId);
      await projection.save();

      const newItemId = ulid();
      await client.saveEvent({
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId: newItemId,
          title: 'New Item',
        },
      });

      const projectionWithExisting = new ListProjection(client, listId, {
        loadExisting: true,
      });
      await projectionWithExisting.save();

      // Add another item
      const newerItemId = ulid();
      await client.saveEvent({
        type: eventTypes.ITEM_ADDED,
        data: {
          listId,
          itemId: newerItemId,
          title: 'Newer Item',
        },
      });

      const refreshedProjection = await projectionWithExisting.refresh();
      const json = await refreshedProjection.asJson();

      expect(json.incompleteItems).toHaveLength(3);
      expect(json.incompleteItems[2]).toMatchObject({
        id: newerItemId,
        text: 'Newer Item',
      });
    });
  });
});
