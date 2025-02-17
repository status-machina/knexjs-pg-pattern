import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

export const ITEM_COMPLETION_SET = 'ITEM_COMPLETION_SET' as const;

export const itemCompletionSetSchema = createEventSchema(
  ITEM_COMPLETION_SET,
  z.object({
    tenantId: z.string(),
    listId: z.string(),
    itemId: z.string(),
    completed: z.boolean(),
  }),
);

export const itemCompletionSetInputSchema = createEventInputSchema(
  ITEM_COMPLETION_SET,
  z.object({
    tenantId: z.string(),
    listId: z.string(),
    itemId: z.string(),
    completed: z.boolean(),
  }),
);

export type ItemCompletionSetEvent = z.infer<typeof itemCompletionSetSchema>;
export type ItemCompletionSetInput = z.infer<
  typeof itemCompletionSetInputSchema
>;
