import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

const itemPrioritySetData = z.object({
  tenantId: z.string(),
  listId: z.string(),
  itemId: z.string(),
  priority: z.number(),
});

export const ITEM_PRIORITY_SET = 'ITEM_PRIORITY_SET' as const;

export const itemPrioritySetSchema = createEventSchema(
  ITEM_PRIORITY_SET,
  itemPrioritySetData,
);
export const itemPrioritySetInputSchema = createEventInputSchema(
  ITEM_PRIORITY_SET,
  itemPrioritySetData,
);

export type ItemPrioritySetEvent = z.infer<typeof itemPrioritySetSchema>;
export type ItemPrioritySetInput = z.infer<typeof itemPrioritySetInputSchema>;
