type Migration = {
  up: string;
  down: string;
};

export const createEventsTableMigration: Migration = {
  up: `
    CREATE SEQUENCE IF NOT EXISTS event_id_seq;

    CREATE TABLE IF NOT EXISTS events (
      id BIGINT PRIMARY KEY DEFAULT nextval('event_id_seq'),
      type TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS events_type_idx ON events(type);
    CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at);
  `,
  down: `
    DROP TABLE IF EXISTS events;
    DROP SEQUENCE IF EXISTS event_id_seq;
  `,
};

export const createProjectionsTableMigration: Migration = {
  up: `
    CREATE TABLE IF NOT EXISTS projections (
      id TEXT PRIMARY KEY,
      latest_event_id BIGINT NOT NULL,
      type TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS projections_type_idx ON projections(type);
    CREATE INDEX IF NOT EXISTS projections_latest_event_id_idx ON projections(latest_event_id);
  `,
  down: 'DROP TABLE IF EXISTS projections;',
};

type CreateDataIndexParams = {
  key: string;
  indexName?: string;
};

export const createEventDataIndexMigration = (
  params: CreateDataIndexParams,
): Migration => {
  const indexName = params.indexName || `events_data_${params.key}_idx`;
  return {
    up: `CREATE INDEX IF NOT EXISTS ${indexName} ON events((data->>'${params.key}'));`,
    down: `DROP INDEX IF EXISTS ${indexName};`,
  };
};

export const createProjectionDataIndexMigration = (
  params: CreateDataIndexParams,
): Migration => {
  const indexName = params.indexName || `projections_data_${params.key}_idx`;
  return {
    up: `CREATE INDEX IF NOT EXISTS ${indexName} ON projections((data->>'${params.key}'));`,
    down: `DROP INDEX IF EXISTS ${indexName};`,
  };
};
