import { Knex, knex } from 'knex';
import * as dotenv from 'dotenv';

dotenv.config();

let client: Knex | undefined;

export async function setupTestDatabase(): Promise<{ client: Knex }> {
  client ||= knex({
    client: 'pg',
    connection: {
      host: 'localhost',
      port: 5432,
      user: 'test_user',
      password: 'test_password',
      database: 'test_db',
    },
  });

  return { client };
}

export async function teardownTestDatabase(): Promise<void> {
  await client?.destroy();
  client = undefined;
} 