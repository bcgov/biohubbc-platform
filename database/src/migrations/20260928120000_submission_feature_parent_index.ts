import { Knex } from 'knex';

/**
 * Index the current children of each submission feature.
 *
 * Upload-scoped expression evaluation walks from matching property rows down to every feature that reaches
 * them through parent links, one level per step, so each step looks up a feature's current children by
 * `parent_submission_feature_id`.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE INDEX submission_feature_idx10
      ON submission_feature (parent_submission_feature_id)
      WHERE record_end_date IS NULL;

    COMMENT ON INDEX submission_feature_idx10 IS
      'Current children of a submission feature, for upload expression walks from evidence down to the features that reach it.';
  `);
}

/**
 * Drop the current-children index.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_feature_idx10;
  `);
}
