import type { Knex } from 'knex';

/**
 * Add survey as the canonical root feature type for new uploads and retire dataset as an active type.
 *
 * Existing submission features remain linked to the legacy dataset row. Only the feature_type row is
 * retired; its historical properties and blueprint assignments remain available for existing records.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DO $$
    DECLARE
      dataset_feature_type_id integer;
      survey_feature_type_id integer;
    BEGIN
      SELECT feature_type_id
      INTO dataset_feature_type_id
      FROM feature_type
      WHERE name = 'dataset'
      ORDER BY record_end_date IS NULL DESC, feature_type_id DESC
      LIMIT 1;

      IF dataset_feature_type_id IS NULL THEN
        RAISE EXCEPTION 'Cannot add survey feature type: dataset feature type was not found.';
      END IF;

      SELECT feature_type_id
      INTO survey_feature_type_id
      FROM feature_type
      WHERE name = 'survey'
        AND record_end_date IS NULL
      LIMIT 1;

      IF survey_feature_type_id IS NULL THEN
        INSERT INTO feature_type (
          name,
          display_name,
          description,
          sort,
          record_effective_date,
          create_user
        )
        SELECT
          'survey',
          'Survey',
          description,
          sort,
          now(),
          1
        FROM feature_type
        WHERE feature_type_id = dataset_feature_type_id
        RETURNING feature_type_id INTO survey_feature_type_id;
      END IF;

      INSERT INTO feature_type_property (
        feature_type_id,
        feature_property_id,
        required_value,
        allow_multiple,
        sort,
        record_effective_date,
        create_user
      )
      SELECT
        survey_feature_type_id,
        ftp.feature_property_id,
        ftp.required_value,
        ftp.allow_multiple,
        ftp.sort,
        now(),
        1
      FROM feature_type_property ftp
      WHERE ftp.feature_type_id = dataset_feature_type_id
        AND ftp.record_end_date IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM feature_type_property existing
          WHERE existing.feature_type_id = survey_feature_type_id
            AND existing.feature_property_id = ftp.feature_property_id
            AND existing.record_end_date IS NULL
        );

      INSERT INTO feature_type_property_feature (
        feature_type_property_id,
        target_feature_type_id,
        create_user
      )
      SELECT
        COALESCE(survey_ftp.feature_type_property_id, ftpf.feature_type_property_id),
        CASE
          WHEN ftpf.target_feature_type_id = dataset_feature_type_id THEN survey_feature_type_id
          ELSE ftpf.target_feature_type_id
        END,
        1
      FROM feature_type_property_feature ftpf
      JOIN feature_type_property source_ftp
        ON source_ftp.feature_type_property_id = ftpf.feature_type_property_id
      LEFT JOIN feature_type_property survey_ftp
        ON survey_ftp.feature_type_id = survey_feature_type_id
       AND survey_ftp.feature_property_id = source_ftp.feature_property_id
       AND survey_ftp.record_end_date IS NULL
      WHERE ftpf.record_end_date IS NULL
        AND (
          source_ftp.feature_type_id = dataset_feature_type_id
          OR ftpf.target_feature_type_id = dataset_feature_type_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM feature_type_property_feature existing
          WHERE existing.feature_type_property_id = COALESCE(survey_ftp.feature_type_property_id, ftpf.feature_type_property_id)
            AND existing.target_feature_type_id = CASE
              WHEN ftpf.target_feature_type_id = dataset_feature_type_id THEN survey_feature_type_id
              ELSE ftpf.target_feature_type_id
            END
            AND existing.record_end_date IS NULL
        );

      INSERT INTO blueprint_feature_type (
        blueprint_id,
        feature_type_id,
        sort,
        create_user
      )
      SELECT
        bft.blueprint_id,
        survey_feature_type_id,
        bft.sort,
        1
      FROM blueprint_feature_type bft
      WHERE bft.feature_type_id = dataset_feature_type_id
        AND bft.record_end_date IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM blueprint_feature_type existing
          WHERE existing.blueprint_id = bft.blueprint_id
            AND existing.feature_type_id = survey_feature_type_id
            AND existing.record_end_date IS NULL
        );

      INSERT INTO blueprint_feature_type_property (
        blueprint_feature_type_id,
        feature_type_property_id,
        required_value,
        allow_multiple,
        sort,
        create_user
      )
      SELECT
        survey_bft.blueprint_feature_type_id,
        survey_ftp.feature_type_property_id,
        bftp.required_value,
        bftp.allow_multiple,
        bftp.sort,
        1
      FROM blueprint_feature_type_property bftp
      JOIN blueprint_feature_type dataset_bft
        ON dataset_bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
      JOIN feature_type_property dataset_ftp
        ON dataset_ftp.feature_type_property_id = bftp.feature_type_property_id
      JOIN feature_type_property survey_ftp
        ON survey_ftp.feature_type_id = survey_feature_type_id
       AND survey_ftp.feature_property_id = dataset_ftp.feature_property_id
       AND survey_ftp.record_end_date IS NULL
      JOIN blueprint_feature_type survey_bft
        ON survey_bft.blueprint_id = dataset_bft.blueprint_id
       AND survey_bft.feature_type_id = survey_feature_type_id
       AND survey_bft.record_end_date IS NULL
      WHERE dataset_bft.feature_type_id = dataset_feature_type_id
        AND dataset_bft.record_end_date IS NULL
        AND dataset_ftp.record_end_date IS NULL
        AND bftp.record_end_date IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM blueprint_feature_type_property existing
          WHERE existing.blueprint_feature_type_id = survey_bft.blueprint_feature_type_id
            AND existing.feature_type_property_id = survey_ftp.feature_type_property_id
            AND existing.record_end_date IS NULL
        );

      UPDATE feature_type
      SET
        record_end_date = now(),
        update_date = now(),
        update_user = 1
      WHERE feature_type_id = dataset_feature_type_id
        AND record_end_date IS NULL;
    END $$;
  `);
}

/**
 * Revert the feature type activation: dataset becomes active again and survey is retired.
 *
 * @param {Knex} knex - Knex database client.
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DO $$
    DECLARE
      dataset_feature_type_id integer;
      survey_feature_type_id integer;
    BEGIN
      SELECT feature_type_id
      INTO survey_feature_type_id
      FROM feature_type
      WHERE name = 'survey'
        AND record_end_date IS NULL
      LIMIT 1;

      SELECT feature_type_id
      INTO dataset_feature_type_id
      FROM feature_type
      WHERE name = 'dataset'
      ORDER BY record_end_date IS NULL DESC, feature_type_id DESC
      LIMIT 1;

      IF survey_feature_type_id IS NULL OR dataset_feature_type_id IS NULL THEN
        RETURN;
      END IF;

      UPDATE feature_type
      SET
        record_end_date = NULL,
        update_date = now(),
        update_user = 1
      WHERE feature_type_id = dataset_feature_type_id;

      UPDATE feature_type
      SET
        record_end_date = now(),
        update_date = now(),
        update_user = 1
      WHERE feature_type_id = survey_feature_type_id
        AND record_end_date IS NULL;
    END $$;
  `);
}
