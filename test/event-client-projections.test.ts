import { describe, it, expect, beforeEach } from 'vitest';
import { createEventClient } from '@status-machina/knexjs-pg-pattern';
import { eventUnion, eventInputUnion, eventTypes } from './example/events';
import { db } from './example/db';
import { ulid } from 'ulidx';
import type { Knex } from 'knex';

type ListProjection = {
  type: 'list';
  id: string;
  data: {
    name: string;
    items: string[];
  };
  lastEventId: bigint;
};

describe.concurrent('EventClient Projections', () => {
  let knex: Knex;

  beforeEach(async () => {
    knex = db;
  });

  describe.concurrent('saveProjection', () => {
    it('should save a projection', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const testId = ulid();

      const event = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: `Test List ${testId}`,
          tenantId: testId,
        },
      });

      await client.saveProjection({
        type: 'list',
        id: listId,
        data: { name: `Test List ${testId}`, items: [] },
        eventId: event.id,
      });

      const projection = await client.getProjection<ListProjection>({
        type: 'list',
        id: listId,
      });

      expect(projection).toMatchObject({
        type: 'list',
        id: listId,
        data: { name: `Test List ${testId}`, items: [] },
        lastEventId: event.id,
      });
    });
  });

  describe.concurrent('queryProjections', () => {
    it('should query projections with filters', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const testId = ulid();
      const listId1 = ulid();
      const listId2 = ulid();

      const event1 = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId: listId1,
          name: `Test List 1 ${testId}`,
          tenantId: testId,
        },
      });

      const event2 = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId: listId2,
          name: `Test List 2 ${testId}`,
          tenantId: testId,
        },
      });

      await client.saveProjection({
        type: 'list',
        id: listId1,
        data: { name: `Test List 1 ${testId}`, items: [], tenantId: testId },
        eventId: event1.id,
      });

      await client.saveProjection({
        type: 'list',
        id: listId2,
        data: { name: `Test List 2 ${testId}`, items: [], tenantId: testId },
        eventId: event2.id,
      });

      const projections = await client.queryProjections<ListProjection>({
        type: 'list',
        filter: { tenantId: { eq: testId } },
      });

      expect(projections).toHaveLength(2);
      expect(projections.map((p) => p.id)).toContain(listId1);
      expect(projections.map((p) => p.id)).toContain(listId2);
    });
  });

  describe.concurrent('forceUpdateProjection', () => {
    it('should force update a projection', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const testId = ulid();

      const event = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: `Test List ${testId}`,
          tenantId: testId,
        },
      });

      await client.saveProjection({
        type: 'list',
        id: listId,
        data: { name: `Test List ${testId}`, items: [] },
        eventId: event.id,
      });

      const newName = `Updated List ${testId}`;
      await client.forceUpdateProjection({
        type: 'list',
        id: listId,
        data: { name: newName, items: [] },
      });

      const projection = await client.getProjection<ListProjection>({
        type: 'list',
        id: listId,
      });

      expect(projection?.data.name).toBe(newName);
    });
  });

  describe.concurrent('conditionalUpdateProjection', () => {
    it('should update projection when new event id is greater than current', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const testId = ulid();

      const event1 = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: `Test List ${testId}`,
          tenantId: testId,
        },
      });

      await client.saveProjection({
        type: 'list',
        id: listId,
        data: { name: `Test List ${testId}`, items: [] },
        eventId: event1.id,
      });

      const event2 = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: `Updated List ${testId}`,
          tenantId: testId,
        },
      });

      // event2.id should be greater than event1.id
      await client.conditionalUpdateProjection({
        type: 'list',
        id: listId,
        data: { name: `Updated List ${testId}`, items: [] },
        eventId: event2.id,
      });

      const projection = await client.getProjection<ListProjection>({
        type: 'list',
        id: listId,
      });

      expect(projection?.data.name).toBe(`Updated List ${testId}`);
      expect(projection?.lastEventId).toBe(event2.id);
    });

    it('should reject when new event id equals current', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const testId = ulid();

      const event = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: `Test List ${testId}`,
          tenantId: testId,
        },
      });

      await client.saveProjection({
        type: 'list',
        id: listId,
        data: { name: `Test List ${testId}`, items: [] },
        eventId: event.id,
      });

      await expect(
        client.conditionalUpdateProjection({
          type: 'list',
          id: listId,
          data: { name: `Should Not Update ${testId}`, items: [] },
          eventId: event.id, // Same event ID
        }),
      ).rejects.toThrow('Concurrent modification detected');

      const projection = await client.getProjection<ListProjection>({
        type: 'list',
        id: listId,
      });

      expect(projection?.data.name).toBe(`Test List ${testId}`);
      expect(projection?.lastEventId).toBe(event.id);
    });

    it('should reject when new event id is less than current', async () => {
      const client = createEventClient(eventUnion, eventInputUnion, knex);
      const listId = ulid();
      const testId = ulid();

      const event1 = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: `Test List ${testId}`,
          tenantId: testId,
        },
      });

      const event2 = await client.saveEvent({
        type: eventTypes.LIST_CREATED,
        data: {
          listId,
          name: `Updated List ${testId}`,
          tenantId: testId,
        },
      });

      // Save with newer event
      await client.saveProjection({
        type: 'list',
        id: listId,
        data: { name: `Updated List ${testId}`, items: [] },
        eventId: event2.id,
      });

      // Try to update with older event
      await expect(
        client.conditionalUpdateProjection({
          type: 'list',
          id: listId,
          data: { name: `Should Not Update ${testId}`, items: [] },
          eventId: event1.id,
        }),
      ).rejects.toThrow('Concurrent modification detected');

      const projection = await client.getProjection<ListProjection>({
        type: 'list',
        id: listId,
      });

      expect(projection?.data.name).toBe(`Updated List ${testId}`);
      expect(projection?.lastEventId).toBe(event2.id);
    });
  });
});
