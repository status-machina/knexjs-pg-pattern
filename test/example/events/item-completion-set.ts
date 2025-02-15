import { z } from 'zod';
import { createEventSchema, createEventInputSchema } from '../../../src/event-schema';

export const ITEM_COMPLETION_SET = 'ITEM_COMPLETION_SET' as const;

export const itemCompletionSetSchema = createEventSchema(
  ITEM_COMPLETION_SET,
  z.object({
    listId: z.string(),
    itemId: z.string(),
    completed: z.boolean()
  })
);

export const itemCompletionSetInputSchema = createEventInputSchema(
  ITEM_COMPLETION_SET,
  z.object({
    listId: z.string(),
    itemId: z.string(),
    completed: z.boolean()
  })
);

export type ItemCompletionSetEvent = z.infer<typeof itemCompletionSetSchema>;
export type ItemCompletionSetInput = z.infer<typeof itemCompletionSetInputSchema>; 