import { z } from 'zod';
import { createEventSchema, createEventInputSchema } from '../../../src/event-schema';

export const ITEM_MARKED_INCOMPLETE = 'ITEM_MARKED_INCOMPLETE' as const;

export const itemMarkedIncompleteSchema = createEventSchema(
  ITEM_MARKED_INCOMPLETE,
  z.object({
    listId: z.string(),
    itemId: z.string()
  })
);

export const itemMarkedIncompleteInputSchema = createEventInputSchema(
  ITEM_MARKED_INCOMPLETE,
  z.object({
    listId: z.string(),
    itemId: z.string()
  })
);

export type ItemMarkedIncompleteEvent = z.infer<typeof itemMarkedIncompleteSchema>;
export type ItemMarkedIncompleteInput = z.infer<typeof itemMarkedIncompleteInputSchema>; 