import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '../../../src/event-schema';

export const ITEM_COMPLETED = 'ITEM_COMPLETED' as const;

export const itemCompletedSchema = createEventSchema(
  ITEM_COMPLETED,
  z.object({
    tenantId: z.string(),
    listId: z.string(),
    itemId: z.string(),
  }),
);

export const itemCompletedInputSchema = createEventInputSchema(
  ITEM_COMPLETED,
  z.object({
    tenantId: z.string(),
    listId: z.string(),
    itemId: z.string(),
  }),
);

export type ItemCompletedEvent = z.infer<typeof itemCompletedSchema>;
export type ItemCompletedInput = z.infer<typeof itemCompletedInputSchema>;
