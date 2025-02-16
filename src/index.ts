export { createEventClient } from './event-client';
export type { EventClient, Event, Projection } from './event-client';
export type { EventInput } from './event-schema';
export type { DataFilter, QueryOperators } from './query-types';
export { SingleStreamValidator, MultiStreamValidator } from './validators';
export {
  createEventsTableMigration,
  createProjectionsTableMigration,
  createEventDataIndexMigration,
  createProjectionDataIndexMigration,
} from './migration-functions';
