import { Knex, knex } from 'knex';

/**
 * Create a Knex instance configured for integration tests.
 * Shared by system integration tests that need direct DB access.
 */
export function createTestKnex(): Knex {
  return knex({
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER_API,
      password: process.env.DB_USER_API_PASS
    },
    searchPath: ['biohub', 'public']
  });
}
