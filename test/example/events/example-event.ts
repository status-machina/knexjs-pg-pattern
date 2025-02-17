import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

const exampleEventData = z.object({
  tenantId: z.string(),
  stringField: z.string(),
  numberField: z.number(),
  booleanField: z.boolean(),
  optionalField: z.string().optional(),
});

export const EXAMPLE_EVENT = 'EXAMPLE_EVENT' as const;

export const exampleEventSchema = createEventSchema(
  EXAMPLE_EVENT,
  exampleEventData,
);
export const exampleEventInputSchema = createEventInputSchema(
  EXAMPLE_EVENT,
  exampleEventData,
);

export type ExampleEvent = z.infer<typeof exampleEventSchema>;
export type ExampleEventInput = z.infer<typeof exampleEventInputSchema>;
