import { z } from 'zod';

// Base schema without discriminator
export const eventBaseSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(val => BigInt(val)),
  type: z.string(),
  created_at: z.union([z.string(), z.date()]).transform(val => 
    val instanceof Date ? val.toISOString() : val
  ).pipe(z.string().datetime()),
  updated_at: z.union([z.string(), z.date()]).transform(val => 
    val instanceof Date ? val.toISOString() : val
  ).pipe(z.string().datetime()),
  data: z.object({}).passthrough(),
});

export const eventInputBaseSchema = z.object({
  type: z.string(),
  data: z.object({}).passthrough(),
});

// Helper to create consistent event schemas
export const createEventSchema = <T extends string, D extends z.ZodObject<any>>(
  type: T,
  dataSchema: D
) => {
  return eventBaseSchema.extend({
    type: z.literal(type),
    data: dataSchema
  });
};

export const createEventInputSchema = <T extends string, D extends z.ZodObject<any>>(
  type: T,
  dataSchema: D
) => {
  return eventInputBaseSchema.extend({
    type: z.literal(type),
    data: dataSchema
  });
};

export type EventSchemaDefinition<T extends string, D extends z.ZodType> = {
  type: T;
  schema: D;
};

export type InferEventType<T extends EventSchemaDefinition<string, z.ZodType>> = {
  id: string;
  type: T['type'];
  data: z.infer<T['schema']>;
  timestamp: number;
};

export type EventRegistry<T extends EventSchemaDefinition<string, z.ZodType>[]> = {
  [K in T[number]['type']]: InferEventType<Extract<T[number], { type: K }>>;
};

export type AnyEvent<R extends EventRegistry<any>> = R[keyof R];

export const createEventDefinition = <T extends string, D extends z.ZodType>(
  type: T,
  dataSchema: D
): EventSchemaDefinition<T, D> => ({
  type,
  schema: dataSchema,
});

export type EventInput<T extends z.ZodType> = Omit<z.infer<T>, 'id' | 'created_at' | 'updated_at'>; 
