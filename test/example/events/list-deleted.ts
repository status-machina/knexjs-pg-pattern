import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

const listDeletedData = z.object({
  tenantId: z.string(),
  listId: z.string(),
});

export const LIST_DELETED = 'LIST_DELETED' as const;

export const listDeletedSchema = createEventSchema(
  LIST_DELETED,
  listDeletedData,
);
export const listDeletedInputSchema = createEventInputSchema(
  LIST_DELETED,
  listDeletedData,
);

export type ListDeletedEvent = z.infer<typeof listDeletedSchema>;
export type ListDeletedInput = z.infer<typeof listDeletedInputSchema>;
