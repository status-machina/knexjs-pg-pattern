/* v8 ignore file */
const { Client } = require('pg');
const { setTimeout } = require('timers/promises');

async function waitForDb(retries = 30, interval = 1000) {
  for (let i = 0; i < retries; i++) {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      user: 'test_user',
      password: 'test_password',
      database: 'test_db',
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('Database is ready!');
      return;
    } catch (err) {
      await client.end().catch(() => {}); // Cleanup even if there's an error
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await setTimeout(interval);
    }
  }

  throw new Error('Database connection failed after retries');
}

waitForDb().catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});
