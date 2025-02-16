import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '../../../src/event-schema';

export const ITEM_ADDED = 'ITEM_ADDED' as const;

export const itemAddedSchema = createEventSchema(
  ITEM_ADDED,
  z.object({
    listId: z.string(),
    itemId: z.string(),
    title: z.string(),
  }),
);

export const itemAddedInputSchema = createEventInputSchema(
  ITEM_ADDED,
  z.object({
    listId: z.string(),
    itemId: z.string(),
    title: z.string(),
  }),
);

export type ItemAddedEvent = z.infer<typeof itemAddedSchema>;
export type ItemAddedInput = z.infer<typeof itemAddedInputSchema>;
