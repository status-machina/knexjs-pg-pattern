import { z } from 'zod';
import { Knex } from 'knex';
import { EventInput } from './event-schema';
import { DataFilter, operatorMap, QueryOperators } from './query-types';

export type EventClient<
  TEventUnion extends z.ZodType,
  TProjection extends Projection<string, unknown>,
> = {
  saveEvent: <T extends z.infer<TEventUnion>['type']>(
    event: EventInput<Extract<z.infer<TEventUnion>, { type: T }>>,
  ) => Promise<Extract<z.infer<TEventUnion>, { type: T }>>;
  saveEvents: <T extends z.infer<TEventUnion>['type']>(
    events: Array<EventInput<Extract<z.infer<TEventUnion>, { type: T }>>>,
  ) => Promise<Array<Extract<z.infer<TEventUnion>, { type: T }>>>;
  getLatestEvent: <T extends z.infer<TEventUnion>['type']>(
    params: GetLatestEventParams<T>,
  ) => Promise<Extract<z.infer<TEventUnion>, { type: T }> | null>;
  getEventStream: <T extends z.infer<TEventUnion>['type']>(
    params: GetEventStreamParams<T>,
  ) => Promise<Array<Extract<z.infer<TEventUnion>, { type: T }>>>;
  getEventStreams: <T extends z.infer<TEventUnion>['type']>(params: {
    streams: Array<{ types: T[]; filter?: DataFilter }>;
  }) => Promise<Array<Extract<z.infer<TEventUnion>, { type: T }>>>;
  saveProjection: (params: SaveProjectionParams) => Promise<void>;
  forceUpdateProjection: (params: UpdateProjectionParams) => Promise<void>;
  conditionalUpdateProjection: (
    params: ConditionalUpdateProjectionParams,
  ) => Promise<void>;
  getProjection: (params: GetProjectionParams) => Promise<TProjection | null>;
  queryProjections: (params: QueryProjectionsParams) => Promise<TProjection[]>;
  saveEventWithStreamValidation: <T extends z.infer<TEventUnion>['type']>(
    params: SaveEventWithValidationParams<
      EventInput<Extract<z.infer<TEventUnion>, { type: T }>>
    >,
  ) => Promise<Extract<z.infer<TEventUnion>, { type: T }>>;
  saveEventsWithStreamValidation: <T extends z.infer<TEventUnion>['type']>(
    params: SaveEventsWithValidationParams<
      EventInput<Extract<z.infer<TEventUnion>, { type: T }>>
    >,
  ) => Promise<Array<Extract<z.infer<TEventUnion>, { type: T }>>>;
};

export type Event<EType extends string, EData extends unknown> = {
  id: string;
  type: EType;
  data: EData;
  timestamp: number;
};

export type Projection<PType extends string, PData extends unknown> = {
  id: string;
  type: PType;
  data: PData;
  lastEventId: string;
};

type GetLatestEventParams<T extends string = string> = {
  type: T;
  filter?: DataFilter;
};

type GetEventStreamParams<T extends string = string> = {
  types: T[];
  filter?: DataFilter;
};

type SaveProjectionParams = {
  type: string;
  id: string;
  data: unknown;
  eventId: string;
};

type UpdateProjectionParams = {
  type: string;
  id: string;
  data: unknown;
};

type ConditionalUpdateProjectionParams = UpdateProjectionParams & {
  eventId: string;
};

type GetProjectionParams = {
  type: string;
  id: string;
};

type QueryProjectionsParams = {
  type: string;
  filter?: Record<string, unknown>;
};

type SaveEventWithValidationParams<TEvent> = {
  event: TEvent;
  latestEventId: bigint;
  streams: Array<{
    types: string[];
    filter?: DataFilter;
  }>;
};

type SaveEventsWithValidationParams<TEvent> = {
  events: TEvent[];
  latestEventId: bigint;
  streams: Array<{
    types: string[];
    filter?: DataFilter;
  }>;
};

const applyDataFilters = (query: Knex.QueryBuilder, filter?: DataFilter) => {
  if (!filter) return query;

  for (const [field, operators] of Object.entries(filter)) {
    for (const [op, value] of Object.entries(operators)) {
      const sqlOperator = operatorMap[op as keyof QueryOperators<any>];

      if (!sqlOperator) {
        throw new Error(`Unknown operator: ${op}`);
      }

      if (Array.isArray(value)) {
        // Handle IN and NOT IN
        if (op === 'nin') {
          query = query.whereRaw(`data->>'${field}' != ALL(?)`, [value]);
        } else {
          query = query.whereRaw(`data->>'${field}' = ANY(?)`, [value]);
        }
      } else if (typeof value === 'number') {
        // Cast to numeric for number comparisons
        query = query.whereRaw(
          `CAST(data->>'${field}' AS numeric) ${sqlOperator} ?`,
          value,
        );
      } else if (typeof value === 'boolean') {
        // Handle boolean values
        query = query.whereRaw(
          `CAST(data->>'${field}' AS boolean) ${sqlOperator} ?`,
          value,
        );
      } else {
        // String comparison (default)
        query = query.whereRaw(`data->>'${field}' ${sqlOperator} ?`, value);
      }
    }
  }

  return query;
};

export const createEventClient = <
  TEventUnion extends z.ZodType,
  TEventInputUnion extends z.ZodType,
  TProjection extends Projection<string, unknown>,
>(
  eventUnion: TEventUnion,
  inputUnion: TEventInputUnion,
  knex: Knex,
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
      const validatedInputs = events.map((event) => inputUnion.parse(event));

      // Insert all events in a transaction
      const savedEvents = await knex.transaction(async (trx) => {
        const events = await trx('events')
          .insert(
            validatedInputs.map((input) => ({
              type: input.type,
              data: input.data,
            })),
          )
          .returning(['id', 'type', 'data', 'created_at', 'updated_at']);

        return events;
      });

      // Parse and validate all events
      return savedEvents.map((event) => eventUnion.parse(event));
    },

    getLatestEvent: async (params) => {
      let query = knex('events').where('type', params.type);

      query = applyDataFilters(query, params.filter);
      query = query.orderBy('id', 'desc').limit(1);

      const [event] = await query.select('*');
      return event ? eventUnion.parse(event) : null;
    },

    getEventStream: async (params) => {
      let query = knex('events').whereIn('type', params.types);

      query = applyDataFilters(query, params.filter);
      query = query.orderBy('id', 'asc');

      const events = await query.select('*');
      return events.map((event) => eventUnion.parse(event));
    },

    getEventStreams: async <T extends z.infer<TEventUnion>['type']>(params: {
      streams: Array<{ types: T[]; filter?: DataFilter }>;
    }): Promise<Array<Extract<z.infer<TEventUnion>, { type: T }>>> => {
      let query = knex('events').distinctOn('id');

      // Build OR conditions for each stream
      query = query.where((builder) => {
        params.streams.forEach((stream, index) => {
          builder.orWhere((subBuilder) => {
            subBuilder.whereIn('type', stream.types);
            applyDataFilters(subBuilder, stream.filter);
          });
        });
      });

      // Order by id to maintain chronological order
      query = query.orderBy('id', 'asc');

      const events = await query.select('*');
      return events.map((event) => eventUnion.parse(event));
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

    saveEventWithStreamValidation: async <
      T extends z.infer<TEventUnion>['type'],
    >(
      params: SaveEventWithValidationParams<
        EventInput<Extract<z.infer<TEventUnion>, { type: T }>>
      >,
    ): Promise<Extract<z.infer<TEventUnion>, { type: T }>> => {
      // Validate the input
      const validatedInput = inputUnion.parse(params.event);

      // Define the CTE using Knex query builder
      const newerEventsQuery = knex
        .select('id')
        .from('events')
        .where('id', '>', params.latestEventId.toString())
        .where((builder) => {
          params.streams.forEach((stream) => {
            builder.orWhere((subBuilder) => {
              subBuilder.whereIn('type', stream.types);
              applyDataFilters(subBuilder, stream.filter);
            });
          });
        })
        .limit(1);

      const sql = `
        WITH newer_events AS (${newerEventsQuery.toString()})
        INSERT INTO events (type, data)
        SELECT ?, ?::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM newer_events)
        RETURNING id, type, data, created_at, updated_at;
      `;

      // Use raw for the insert with CTE
      const result = await knex.raw(sql, [
        validatedInput.type,
        validatedInput.data,
      ]);

      if (!result?.rows?.[0]) {
        throw new Error('Concurrent modification detected');
      }

      return eventUnion.parse(result.rows[0]);
    },

    saveEventsWithStreamValidation: async <
      T extends z.infer<TEventUnion>['type'],
    >(
      params: SaveEventsWithValidationParams<
        EventInput<Extract<z.infer<TEventUnion>, { type: T }>>
      >,
    ): Promise<Array<Extract<z.infer<TEventUnion>, { type: T }>>> => {
      // Validate all inputs
      const validatedInputs = params.events.map(
        (event: EventInput<Extract<z.infer<TEventUnion>, { type: T }>>) =>
          inputUnion.parse(event),
      );

      // Define the CTE using Knex query builder
      const newerEventsQuery = knex
        .select('id')
        .from('events')
        .where('id', '>', params.latestEventId.toString())
        .where((builder) => {
          params.streams.forEach((stream) => {
            builder.orWhere((subBuilder) => {
              subBuilder.whereIn('type', stream.types);
              applyDataFilters(subBuilder, stream.filter);
            });
          });
        })
        .limit(1);

      const sql = `
        WITH newer_events AS (${newerEventsQuery.toString()})
        INSERT INTO events (type, data)
        SELECT * FROM (VALUES ${validatedInputs.map(() => '(?, ?::jsonb)').join(',')}) AS v(type, data)
        WHERE NOT EXISTS (SELECT 1 FROM newer_events)
        RETURNING id, type, data, created_at, updated_at;
      `;

      const values = validatedInputs.flatMap((input) => [
        input.type,
        JSON.stringify(input.data),
      ]);
      const result = await knex.raw(sql, values);

      if (!result?.rows?.length) {
        throw new Error('Concurrent modification detected');
      }

      return result.rows.map((event: z.infer<TEventUnion>) =>
        eventUnion.parse(event),
      );
    },
  };
};
