import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const DB_ADMIN = process.env.DB_ADMIN;

/**
 * Seed a single 'Home' gallery for local and test environments only.
 *
 * Production galleries are created by an admin or a consumer migration, so gallery ids are not stable
 * across environments. Consumers must therefore reference a gallery by its name rather than its id.
 * This seed exists purely to give local/test environments a 'Home' gallery to reference by name.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    set schema '${DB_SCHEMA}';
    set search_path = ${DB_SCHEMA};
  `);

  // check if the 'Home' gallery already exists among active records
  const response = await knex.raw(`
    ${getActiveGalleryByNameSQL('Home')}
  `);

  // if the fetch returns no rows, then the gallery does not exist and should be added
  if (!response?.rows?.[0]) {
    await knex.raw(`
      ${insertGallerySQL('Home', 'Downloads featured on the BioHub home screen')}
    `);
  }
}

/**
 * SQL to fetch an active (non-soft-deleted) gallery by name.
 *
 * @param {string} name
 */
const getActiveGalleryByNameSQL = (name: string) => `
  SELECT
    name
  FROM
    gallery
  WHERE
    name = '${name}'
  AND
    record_end_date IS NULL;
`;

/**
 * SQL to insert a gallery row, attributing creation to the database admin user.
 *
 * @param {string} name
 * @param {string} description
 */
const insertGallerySQL = (name: string, description: string) => `
  INSERT INTO gallery (
    name,
    description,
    create_user
  ) VALUES (
    '${name}',
    '${description}',
    (SELECT system_user_id FROM "system_user" WHERE LOWER(user_identifier) = LOWER('${DB_ADMIN}'))
  );
`;
