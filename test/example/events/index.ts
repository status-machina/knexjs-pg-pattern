import { z } from 'zod';
import { listCreatedSchema, listCreatedInputSchema, LIST_CREATED } from './list-created';
import { listDeletedSchema, listDeletedInputSchema, LIST_DELETED } from './list-deleted';
import { itemPrioritySetSchema, itemPrioritySetInputSchema, ITEM_PRIORITY_SET } from './item-priority-set';
import { itemCompletionSetSchema, itemCompletionSetInputSchema, ITEM_COMPLETION_SET } from './item-completion-set';

export const eventTypes = {
  LIST_CREATED,
  LIST_DELETED,
  ITEM_PRIORITY_SET,
  ITEM_COMPLETION_SET,
} as const;

export type EventType = typeof eventTypes[keyof typeof eventTypes];

export const eventSchemas = [
  listCreatedSchema,
] as const;
    
export const eventInputSchemas = [
  listCreatedInputSchema,
] as const;

export const otherEventSchemas = [listDeletedSchema] as const;

export const otherEventInputSchemas = [listDeletedInputSchema] as const;

export const eventUnion = z.discriminatedUnion('type', [
  listCreatedSchema,
  listDeletedSchema,
  itemPrioritySetSchema,
  itemCompletionSetSchema
]);

export const eventInputUnion = z.discriminatedUnion('type', [
  listCreatedInputSchema,
  listDeletedInputSchema,
  itemPrioritySetInputSchema,
  itemCompletionSetInputSchema
]);

export type UserEvent = z.infer<typeof eventUnion>;

// Type guard
export const isUserEvent = (event: unknown): event is UserEvent => {
  return eventUnion.safeParse(event).success;
}; 