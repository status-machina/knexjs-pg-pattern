import { z } from 'zod';
import { createEventSchema, createEventInputSchema } from '../../../src/event-schema';

export const LIST_CREATED = 'LIST_CREATED' as const;

export const listCreatedSchema = createEventSchema(
  LIST_CREATED,
  z.object({
    listId: z.string(),
    name: z.string(),
  })
);

export const listCreatedInputSchema = createEventInputSchema(
  LIST_CREATED,
  z.object({
    listId: z.string(),
    name: z.string(),
  })
);

export type ListCreatedEvent = z.infer<typeof listCreatedSchema>;
export type ListCreatedInput = z.infer<typeof listCreatedInputSchema>; 