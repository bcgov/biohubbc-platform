import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const DB_ADMIN = process.env.DB_ADMIN;

/**
 * Seed a single 'Home' gallery for local and test environments only.
 *
 * Production galleries are created by an admin or a consumer migration, so gallery ids are not stable
 * across environments. Consumers must therefore reference a gallery by its slug rather than its id.
 * This seed exists purely to give local/test environments a 'home' gallery to reference by slug.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw('set search_path = ??;', [DB_SCHEMA]);

  const existingGallery = await knex('gallery')
    .select('slug')
    .where({ slug: 'home' })
    .whereNull('record_end_date')
    .first();

  if (existingGallery) {
    return;
  }

  await knex('gallery').insert({
    name: 'Home',
    slug: 'home',
    visibility: 'public',
    description: 'Downloads featured on the BioHub home screen',
    create_user: knex('system_user')
      .select('system_user_id')
      .whereRaw('LOWER(user_identifier) = LOWER(?)', [DB_ADMIN])
      .first()
  });
}
