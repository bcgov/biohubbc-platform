import type { Knex } from 'knex';

/**
 * Rename the legacy dataset feature type to survey.
 *
 * This intentionally does not edit historical seed/migration files. Existing
 * rows are updated in place so feature_type_id references remain stable.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    UPDATE feature_type
    SET
      name = 'survey',
      display_name = 'Survey',
      update_date = now(),
      update_user = 1
    WHERE name = 'dataset'
      AND record_end_date IS NULL;

    UPDATE security_scope
    SET
      urn_feature_type = 'survey',
      scope_hash = encode(
        sha256(convert_to('urn:' || urn_submission_id || ':survey:' || urn_feature_id, 'UTF8')),
        'hex'
      )
    WHERE urn_feature_type = 'dataset';

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'biohub'
          AND table_name = 'policy_statement'
          AND column_name = 'submission_feature_urn'
      ) THEN
        UPDATE policy_statement
        SET
          submission_feature_urn = regexp_replace(submission_feature_urn, '^urn:([^:]+):dataset:', 'urn:\\1:survey:'),
          urn_feature_type = CASE WHEN urn_feature_type = 'dataset' THEN 'survey' ELSE urn_feature_type END
        WHERE submission_feature_urn LIKE 'urn:%:dataset:%'
           OR urn_feature_type = 'dataset';
      END IF;
    END $$;
  `);
}

/**
 * Revert the survey feature type rename back to dataset.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'biohub'
          AND table_name = 'policy_statement'
          AND column_name = 'submission_feature_urn'
      ) THEN
        UPDATE policy_statement
        SET
          submission_feature_urn = regexp_replace(submission_feature_urn, '^urn:([^:]+):survey:', 'urn:\\1:dataset:'),
          urn_feature_type = CASE WHEN urn_feature_type = 'survey' THEN 'dataset' ELSE urn_feature_type END
        WHERE submission_feature_urn LIKE 'urn:%:survey:%'
           OR urn_feature_type = 'survey';
      END IF;
    END $$;

    UPDATE security_scope
    SET
      urn_feature_type = 'dataset',
      scope_hash = encode(
        sha256(convert_to('urn:' || urn_submission_id || ':dataset:' || urn_feature_id, 'UTF8')),
        'hex'
      )
    WHERE urn_feature_type = 'survey';

    UPDATE feature_type
    SET
      name = 'dataset',
      display_name = 'Dataset',
      update_date = now(),
      update_user = 1
    WHERE name = 'survey'
      AND record_end_date IS NULL;
  `);
}
