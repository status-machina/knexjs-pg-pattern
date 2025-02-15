import { z } from 'zod';
import { createEventSchema, createEventInputSchema } from '../../../src/event-schema';

export const ITEM_PRIORITY_SET = 'ITEM_PRIORITY_SET' as const;

export const itemPrioritySetSchema = createEventSchema(
  ITEM_PRIORITY_SET,
  z.object({
    listId: z.string(),
    itemId: z.string(),
    priority: z.number()
  })
);

export const itemPrioritySetInputSchema = createEventInputSchema(
  ITEM_PRIORITY_SET,
  z.object({
    listId: z.string(),
    itemId: z.string(),
    priority: z.number()
  })
);

export type ItemPrioritySetEvent = z.infer<typeof itemPrioritySetSchema>;
export type ItemPrioritySetInput = z.infer<typeof itemPrioritySetInputSchema>; 