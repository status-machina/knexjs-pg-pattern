export { createEventClient } from './event-client';
export type { EventClient } from './event-client';
export type { Projection } from './event-client';
export { SingleStreamProjection } from './projections/single-stream-projection';
export { MultiStreamProjection } from './projections/multi-stream-projection';
export type { EventInput } from './event-schema';
export type { DataFilter, QueryOperators } from './query-types';
export { SingleStreamValidator, MultiStreamValidator } from './validators';
export {
  createEventsTableMigration,
  createProjectionsTableMigration,
  createEventDataIndexMigration,
  createProjectionDataIndexMigration,
} from './migration-functions';
export { createEventSchema, createEventInputSchema } from './event-schema';
