import { z } from 'zod';
import { Knex } from 'knex';
import { EventInput } from './event-schema';
import { DataFilter, operatorMap, QueryOperators } from './query-types';

export type EventClient<
  TEventUnion extends z.ZodType,
  TProjection extends Projection<string, unknown>
> = {
  saveEvent: <T extends z.infer<TEventUnion>['type']>(
    event: EventInput<Extract<z.infer<TEventUnion>, { type: T }>>
  ) => Promise<Extract<z.infer<TEventUnion>, { type: T }>>;
  saveEvents: <T extends z.infer<TEventUnion>['type']>(
    events: Array<EventInput<Extract<z.infer<TEventUnion>, { type: T }>>>
  ) => Promise<Array<Extract<z.infer<TEventUnion>, { type: T }>>>;
  getLatestEvent: <T extends z.infer<TEventUnion>['type']>(
    params: GetLatestEventParams<T>
  ) => Promise<Extract<z.infer<TEventUnion>, { type: T }> | null>;
  getEventStream: (params: GetEventStreamParams) => Promise<z.infer<TEventUnion>[]>;
  getEventStreams: (params: GetEventStreamsParams) => Promise<Record<string, z.infer<TEventUnion>[]>>;
  saveProjection: (params: SaveProjectionParams) => Promise<void>;
  forceUpdateProjection: (params: UpdateProjectionParams) => Promise<void>;
  conditionalUpdateProjection: (params: ConditionalUpdateProjectionParams) => Promise<void>;
  getProjection: (params: GetProjectionParams) => Promise<TProjection | null>;
  queryProjections: (params: QueryProjectionsParams) => Promise<TProjection[]>;
  saveEventWithStreamValidation: (params: SaveEventWithValidationParams<z.infer<TEventUnion>>) => Promise<void>;
}

export type Event<EType extends string, EData extends unknown> = {
  id: string;
  type: EType;
  data: EData;
  timestamp: number;
}

export type Projection<PType extends string, PData extends unknown> = {
  id: string;
  type: PType;
  data: PData;
  lastEventId: string;
}

type GetLatestEventParams<T extends string = string> = {
  type: T;
  filter?: DataFilter;
}

type GetEventStreamParams = {
  types: string[];
  filter?: Record<string, unknown>;
}

type GetEventStreamsParams = {
  streams: Array<{
    types: string[];
    filter?: Record<string, unknown>;
  }>;
}

type SaveProjectionParams = {
  type: string;
  id: string;
  data: unknown;
  eventId: string;
}

type UpdateProjectionParams = {
  type: string;
  id: string;
  data: unknown;
}

type ConditionalUpdateProjectionParams = UpdateProjectionParams & {
  eventId: string;
}

type GetProjectionParams = {
  type: string;
  id: string;
}

type QueryProjectionsParams = {
  type: string;
  filter?: Record<string, unknown>;
}

type SaveEventWithValidationParams<TEvent> = {
  event: TEvent;
  streams: GetEventStreamParams[];
}

export const createEventClient = <
  TEventUnion extends z.ZodType,
  TEventInputUnion extends z.ZodType,
  TProjection extends Projection<string, unknown>
>(
  eventUnion: TEventUnion, 
  inputUnion: TEventInputUnion,
  knex: Knex
): EventClient<TEventUnion, TProjection> => {
  return {
    saveEvent: async (event) => {
      // Validate the input
      const validatedInput = inputUnion.parse(event);
      
      // Insert into database
      const [savedEvent] = await knex('events')
        .insert({
          type: validatedInput.type,
          data: validatedInput.data,
        })
        .returning(['id', 'type', 'data', 'created_at', 'updated_at']);

      // Parse and validate the complete event - transformation happens automatically
      return eventUnion.parse(savedEvent);
    },

    saveEvents: async (events) => {
      // Validate all inputs first
      const validatedInputs = events.map(event => inputUnion.parse(event));
      
      // Insert all events in a transaction
      const savedEvents = await knex.transaction(async (trx) => {
        const events = await trx('events')
          .insert(validatedInputs.map(input => ({
            type: input.type,
            data: input.data,
          })))
          .returning(['id', 'type', 'data', 'created_at', 'updated_at']);

        return events;
      });

      // Parse and validate all events
      return savedEvents.map(event => eventUnion.parse(event));
    },

    getLatestEvent: async (params) => {
      let query = knex('events')
        .where('type', params.type);

      if (params.filter) {
        for (const [field, operators] of Object.entries(params.filter)) {
          for (const [op, value] of Object.entries(operators)) {
            const sqlOperator = operatorMap[op as keyof QueryOperators<any>];
            
            if (!sqlOperator) {
              throw new Error(`Unknown operator: ${op}`);
            }

            if (Array.isArray(value)) {
              // Handle IN and NOT IN
              query = query.whereRaw(`data->>'${field}' = ANY(?)`, [value]);
            } else if (typeof value === 'number') {
              // Cast to numeric for number comparisons
              query = query.whereRaw(
                `CAST(data->>'${field}' AS numeric) ${sqlOperator} ?`,
                value
              );
            } else if (typeof value === 'boolean') {
              // Handle boolean values
              query = query.whereRaw(
                `CAST(data->>'${field}' AS boolean) ${sqlOperator} ?`,
                value
              );
            } else {
              // String comparison (default)
              query = query.whereRaw(
                `data->>'${field}' ${sqlOperator} ?`,
                value
              );
            }
          }
        }
      }

      query = query.orderBy('id', 'desc')
        .limit(1);

      const [event] = await query.select('*');
      return event ? eventUnion.parse(event) : null;
    },

    getEventStream: async (params) => {
      // Get chronological stream of events
      return [];
    },

    getEventStreams: async (params) => {
      // Get multiple event streams simultaneously
      return {};
    },

    saveProjection: async (params) => {
      // Save/update projection conditionally based on event ID
    },

    forceUpdateProjection: async (params) => {
      // Update projection unconditionally
    },

    conditionalUpdateProjection: async (params) => {
      // Update projection if new event ID is more recent
    },

    getProjection: async (params) => {
      // Get single projection by type and ID
      return null;
    },

    queryProjections: async (params) => {
      // Search projections by type with optional filtering
      return [];
    },

    saveEventWithStreamValidation: async (params) => {
      // Save event with concurrency check against specified streams
    }
  };
};
