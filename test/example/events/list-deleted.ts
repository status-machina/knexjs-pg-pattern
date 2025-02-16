import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '../../../src/event-schema';

export const LIST_DELETED = 'LIST_DELETED' as const;

export const listDeletedSchema = createEventSchema(
  LIST_DELETED,
  z.object({
    listId: z.string(),
  }),
);

export const listDeletedInputSchema = createEventInputSchema(
  LIST_DELETED,
  z.object({
    listId: z.string(),
  }),
);

export type ListDeletedEvent = z.infer<typeof listDeletedSchema>;
export type ListDeletedInput = z.infer<typeof listDeletedInputSchema>;
