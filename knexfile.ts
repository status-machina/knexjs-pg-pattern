// This is the KnexJS configuration file for the project tests
import type { Knex } from "knex";

const config: { [key: string]: Knex.Config } = {
  test: {
    client: "postgresql",
    connection: {
      database: "test_db",
      user: "test_user",
      password: "test_password",
    },
    pool: {
      min: 1,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
      extension: "ts",
    },
  },
};

export default config.test;
