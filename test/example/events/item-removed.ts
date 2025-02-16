import { z } from 'zod';
import { createEventSchema, createEventInputSchema } from '../../../src/event-schema';

export const ITEM_REMOVED = 'ITEM_REMOVED' as const;

export const itemRemovedSchema = createEventSchema(
  ITEM_REMOVED,
  z.object({
    listId: z.string(),
    itemId: z.string()
  })
);

export const itemRemovedInputSchema = createEventInputSchema(
  ITEM_REMOVED,
  z.object({
    listId: z.string(),
    itemId: z.string()
  })
);

export type ItemRemovedEvent = z.infer<typeof itemRemovedSchema>;
export type ItemRemovedInput = z.infer<typeof itemRemovedInputSchema>; 