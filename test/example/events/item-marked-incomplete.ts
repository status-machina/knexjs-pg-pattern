import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

const itemMarkedIncompleteData = z.object({
  tenantId: z.string(),
  listId: z.string(),
  itemId: z.string(),
});

export const ITEM_MARKED_INCOMPLETE = 'ITEM_MARKED_INCOMPLETE' as const;

export const itemMarkedIncompleteSchema = createEventSchema(
  ITEM_MARKED_INCOMPLETE,
  itemMarkedIncompleteData,
);

export const itemMarkedIncompleteInputSchema = createEventInputSchema(
  ITEM_MARKED_INCOMPLETE,
  itemMarkedIncompleteData,
);

export type ItemMarkedIncompleteEvent = z.infer<
  typeof itemMarkedIncompleteSchema
>;
export type ItemMarkedIncompleteInput = z.infer<
  typeof itemMarkedIncompleteInputSchema
>;
