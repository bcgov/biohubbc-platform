import { Knex } from 'knex';

/** Add the optional submission scope persisted by search-map contexts. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path = biohub, public;

    ALTER TABLE martin_context ADD COLUMN submission_ids integer[];

    COMMENT ON COLUMN martin_context.submission_ids IS
      'Optional submission scope for the search. NULL means all submissions.';

    COMMENT ON COLUMN martin_context.context_hash IS
      'Hash of (expression id, feature type, system user, submission scope). Lets an identical request reuse a live context, which is what makes tile caching effective.';
  `);
}

/** Remove the search-map submission scope. */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path = biohub, public;

    ALTER TABLE martin_context DROP COLUMN submission_ids;

    COMMENT ON COLUMN martin_context.context_hash IS
      'Hash of (expression id, feature type, system user). Lets an identical request reuse a live context, which is what makes tile caching effective.';
  `);
}
