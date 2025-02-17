import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

const itemCompletedData = z.object({
  tenantId: z.string(),
  listId: z.string(),
  itemId: z.string(),
});

export const ITEM_COMPLETED = 'ITEM_COMPLETED' as const;

export const itemCompletedSchema = createEventSchema(
  ITEM_COMPLETED,
  itemCompletedData,
);
export const itemCompletedInputSchema = createEventInputSchema(
  ITEM_COMPLETED,
  itemCompletedData,
);

export type ItemCompletedEvent = z.infer<typeof itemCompletedSchema>;
export type ItemCompletedInput = z.infer<typeof itemCompletedInputSchema>;
