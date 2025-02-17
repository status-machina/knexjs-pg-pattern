import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

const itemRemovedData = z.object({
  tenantId: z.string(),
  listId: z.string(),
  itemId: z.string(),
});

export const ITEM_REMOVED = 'ITEM_REMOVED' as const;

export const itemRemovedSchema = createEventSchema(
  ITEM_REMOVED,
  itemRemovedData,
);
export const itemRemovedInputSchema = createEventInputSchema(
  ITEM_REMOVED,
  itemRemovedData,
);

export type ItemRemovedEvent = z.infer<typeof itemRemovedSchema>;
export type ItemRemovedInput = z.infer<typeof itemRemovedInputSchema>;
