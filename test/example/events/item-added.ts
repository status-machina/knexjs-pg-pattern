import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

const itemAddedData = z.object({
  tenantId: z.string(),
  listId: z.string(),
  itemId: z.string(),
  title: z.string(),
});

export const ITEM_ADDED = 'ITEM_ADDED' as const;

export const itemAddedSchema = createEventSchema(ITEM_ADDED, itemAddedData);
export const itemAddedInputSchema = createEventInputSchema(
  ITEM_ADDED,
  itemAddedData,
);

export type ItemAddedEvent = z.infer<typeof itemAddedSchema>;
export type ItemAddedInput = z.infer<typeof itemAddedInputSchema>;
