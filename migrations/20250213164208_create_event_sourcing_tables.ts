import type { Knex } from "knex";
import { createEventsTableMigration, createProjectionsTableMigration } from "../dist";


export async function up(knex: Knex): Promise<void> {
    await knex.raw(createEventsTableMigration.up);
    await knex.raw(createProjectionsTableMigration.up);
}


export async function down(knex: Knex): Promise<void> {
    await knex.raw(createEventsTableMigration.down);
    await knex.raw(createProjectionsTableMigration.down);
}

