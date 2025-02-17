import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

export const EXAMPLE_EVENT = 'EXAMPLE_EVENT' as const;

export const exampleEventSchema = createEventSchema(
  EXAMPLE_EVENT,
  z.object({
    tenantId: z.string(),
    stringField: z.string(),
    numberField: z.number(),
    booleanField: z.boolean(),
    optionalField: z.string().optional(),
  }),
);

export const exampleEventInputSchema = createEventInputSchema(
  EXAMPLE_EVENT,
  z.object({
    tenantId: z.string(),
    stringField: z.string(),
    numberField: z.number(),
    booleanField: z.boolean(),
    optionalField: z.string().optional(),
  }),
);

export type ExampleEvent = z.infer<typeof exampleEventSchema>;
export type ExampleEventInput = z.infer<typeof exampleEventInputSchema>;
