import { z } from 'zod';
import {
  listCreatedSchema,
  listCreatedInputSchema,
  LIST_CREATED,
} from './list-created';
import {
  listDeletedSchema,
  listDeletedInputSchema,
  LIST_DELETED,
} from './list-deleted';
import {
  itemPrioritySetSchema,
  itemPrioritySetInputSchema,
  ITEM_PRIORITY_SET,
} from './item-priority-set';
import {
  itemAddedSchema,
  itemAddedInputSchema,
  ITEM_ADDED,
} from './item-added';
import {
  itemRemovedSchema,
  itemRemovedInputSchema,
  ITEM_REMOVED,
} from './item-removed';
import {
  itemCompletedSchema,
  itemCompletedInputSchema,
  ITEM_COMPLETED,
} from './item-completed';
import {
  itemMarkedIncompleteSchema,
  itemMarkedIncompleteInputSchema,
  ITEM_MARKED_INCOMPLETE,
} from './item-marked-incomplete';

export const eventTypes = {
  LIST_CREATED,
  LIST_DELETED,
  ITEM_PRIORITY_SET,
  ITEM_ADDED,
  ITEM_REMOVED,
  ITEM_COMPLETED,
  ITEM_MARKED_INCOMPLETE,
} as const;

export type EventType = (typeof eventTypes)[keyof typeof eventTypes];

export const eventSchemas = [listCreatedSchema] as const;

export const eventInputSchemas = [listCreatedInputSchema] as const;

export const otherEventSchemas = [listDeletedSchema] as const;

export const otherEventInputSchemas = [listDeletedInputSchema] as const;

export const eventUnion = z.discriminatedUnion('type', [
  listCreatedSchema,
  listDeletedSchema,
  itemPrioritySetSchema,
  itemAddedSchema,
  itemRemovedSchema,
  itemCompletedSchema,
  itemMarkedIncompleteSchema,
]);

export const eventInputUnion = z.discriminatedUnion('type', [
  listCreatedInputSchema,
  listDeletedInputSchema,
  itemPrioritySetInputSchema,
  itemAddedInputSchema,
  itemRemovedInputSchema,
  itemCompletedInputSchema,
  itemMarkedIncompleteInputSchema,
]);

export type UserEvent = z.infer<typeof eventUnion>;

export type UserEventInput = z.infer<typeof eventInputUnion>;

// Type guard
export const isUserEvent = (event: unknown): event is UserEvent => {
  return eventUnion.safeParse(event).success;
};
