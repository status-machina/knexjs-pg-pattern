import '../dist';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from './setup';
import { Knex } from 'knex';

describe('Test', () => {
  let client: Knex;

  beforeAll(async () => {
    const { client: newClient } = await setupTestDatabase();
    client = newClient;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('should be true', () => {
    expect(true).toBe(true);
  });
});
