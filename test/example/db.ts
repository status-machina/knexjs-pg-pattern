import knex from 'knex';
import * as dotenv from "dotenv";

dotenv.config();

export const db = knex({
  client: "pg",
  connection: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    database: process.env.POSTGRES_DB || "event_sourcing",
  },
  pool: {
    min: 2,
    max: 10,
  },
}); 
