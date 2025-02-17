/* v8 ignore file */
// These migrations are only used for testing
import type { Knex } from 'knex';
import {
  createEventDataIndexMigration,
  createProjectionDataIndexMigration,
} from '../dist';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    createEventDataIndexMigration({
      key: 'listId',
    }).up,
  );
  await knex.raw(
    createEventDataIndexMigration({
      key: 'itemId',
    }).up,
  );
  await knex.raw(
    createProjectionDataIndexMigration({
      key: 'listId',
    }).up,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    createEventDataIndexMigration({
      key: 'listId',
    }).down,
  );
  await knex.raw(
    createEventDataIndexMigration({
      key: 'itemId',
    }).down,
  );
  await knex.raw(
    createProjectionDataIndexMigration({
      key: 'listId',
    }).down,
  );
}
