console.log('Hello World');

export { createEventClient } from './event-client';
export type { EventClient, Event, Projection } from './event-client';
export { 
  createEventsTableMigration,
  createProjectionsTableMigration,
  createEventDataIndexMigration,
  createProjectionDataIndexMigration
} from './migration-functions';
