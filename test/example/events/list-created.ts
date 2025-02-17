import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

const listCreatedData = z.object({
  tenantId: z.string(),
  listId: z.string(),
  name: z.string(),
});

export const LIST_CREATED = 'LIST_CREATED' as const;

export const listCreatedSchema = createEventSchema(
  LIST_CREATED,
  listCreatedData,
);
export const listCreatedInputSchema = createEventInputSchema(
  LIST_CREATED,
  listCreatedData,
);

export type ListCreatedEvent = z.infer<typeof listCreatedSchema>;
export type ListCreatedInput = z.infer<typeof listCreatedInputSchema>;
