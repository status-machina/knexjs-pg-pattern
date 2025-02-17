import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

export const ITEM_PRIORITY_SET = 'ITEM_PRIORITY_SET' as const;

export const itemPrioritySetSchema = createEventSchema(
  ITEM_PRIORITY_SET,
  z.object({
    tenantId: z.string(),
    listId: z.string(),
    itemId: z.string(),
    priority: z.number(),
  }),
);

export const itemPrioritySetInputSchema = createEventInputSchema(
  ITEM_PRIORITY_SET,
  z.object({
    tenantId: z.string(),
    listId: z.string(),
    itemId: z.string(),
    priority: z.number(),
  }),
);

export type ItemPrioritySetEvent = z.infer<typeof itemPrioritySetSchema>;
export type ItemPrioritySetInput = z.infer<typeof itemPrioritySetInputSchema>;
