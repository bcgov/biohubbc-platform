import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    CREATE OR REPLACE FUNCTION tr_validate_predicate_feature_property_type_match()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      _expected_feature_property_type_id integer;
    BEGIN
      -- Ignore inactive predicate rows.
      IF NEW.record_end_date IS NOT NULL THEN
        RETURN NULL;
      END IF;

      SELECT fp.feature_property_type_id
      INTO _expected_feature_property_type_id
      FROM feature_property fp
      WHERE fp.feature_property_id = NEW.feature_property_id
        AND fp.record_end_date IS NULL;

      IF _expected_feature_property_type_id IS NULL THEN
        RAISE EXCEPTION 'Active predicate % references inactive or missing feature_property %', NEW.predicate_id, NEW.feature_property_id;
      END IF;

      IF _expected_feature_property_type_id <> NEW.feature_property_type_id THEN
        RAISE EXCEPTION 'Active predicate % has feature_property_type_id % but feature_property % requires %', NEW.predicate_id, NEW.feature_property_type_id, NEW.feature_property_id, _expected_feature_property_type_id;
      END IF;

      IF NEW.feature_type_property_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM feature_type_property ftp
        WHERE ftp.feature_type_property_id = NEW.feature_type_property_id
          AND ftp.feature_property_id = NEW.feature_property_id
          AND ftp.record_end_date IS NULL
      ) THEN
        RAISE EXCEPTION 'Active predicate % references inactive, missing, or mismatched feature_type_property %', NEW.predicate_id, NEW.feature_type_property_id;
      END IF;

      RETURN NULL;
    END;
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    CREATE OR REPLACE FUNCTION tr_validate_predicate_feature_property_type_match()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      _expected_feature_property_type_id integer;
    BEGIN
      -- Ignore inactive predicate rows.
      IF NEW.record_end_date IS NOT NULL THEN
        RETURN NULL;
      END IF;

      -- Original broken definition restored for rollback parity.
      SELECT ftp.feature_property_type_id
      INTO _expected_feature_property_type_id
      FROM feature_type_property ftp
      WHERE ftp.feature_type_property_id = NEW.feature_type_property_id
        AND ftp.record_end_date IS NULL;

      IF _expected_feature_property_type_id IS NULL THEN
        RAISE EXCEPTION 'Active predicate % references inactive or missing feature_type_property %', NEW.predicate_id, NEW.feature_type_property_id;
      END IF;

      IF _expected_feature_property_type_id <> NEW.feature_property_type_id THEN
        RAISE EXCEPTION 'Active predicate % has feature_property_type_id % but feature_type_property % requires %', NEW.predicate_id, NEW.feature_property_type_id, NEW.feature_type_property_id, _expected_feature_property_type_id;
      END IF;

      RETURN NULL;
    END;
    $$;
  `);
}
