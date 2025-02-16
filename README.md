# @status-machina/knexjs-pg-pattern

A library providing event sourcing patterns for PostgreSQL using Knex.js.

## Getting Started

### Install

```bash
npm install @status-machina/knexjs-pg-pattern
npm install knex@3.1.0 pg
```

### Create Required Tables

The library requires two tables: `events` and `projections`. First, generate the migration files:

```bash
# Generate the initial migration
npx knex migrate:make create_event_sourcing_tables
```

Then use the provided migrations in your newly created file (timestamp_create_event_sourcing_tables.ts):

```typescript
import {
  createEventsTableMigration,
  createProjectionsTableMigration,
} from '@status-machina/knexjs-pg-pattern';
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(createEventsTableMigration.up);
  await knex.raw(createProjectionsTableMigration.up);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(createProjectionsTableMigration.down);
  await knex.raw(createEventsTableMigration.down);
}
```

Run the migration:

```bash
npx knex migrate:latest
```

### Adding Data Indexes

To improve query performance, you can create indexes on specific JSON fields. First, generate a new migration:

```bash
npx knex migrate:make add_event_sourcing_indexes
```

Then use the provided index creators in your migration file (timestamp_add_event_sourcing_indexes.ts):

```typescript
import {
  createEventDataIndexMigration,
  createProjectionDataIndexMigration,
} from '@status-machina/knexjs-pg-pattern';
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create an index on events.data->>'userId'
  const eventIndex = createEventDataIndexMigration({ key: 'userId' });
  await knex.raw(eventIndex.up);

  // Create an index on projections.data->>'status'
  const projectionIndex = createProjectionDataIndexMigration({
    key: 'status',
    indexName: 'custom_status_idx', // optional
  });
  await knex.raw(projectionIndex.up);
}

export async function down(knex: Knex): Promise<void> {
  const eventIndex = createEventDataIndexMigration({ key: 'userId' });
  const projectionIndex = createProjectionDataIndexMigration({
    key: 'status',
    indexName: 'custom_status_idx',
  });

  await knex.raw(projectionIndex.down);
  await knex.raw(eventIndex.down);
}
```

Run the migration:

```bash
npx knex migrate:latest
```
