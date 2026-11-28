import type { Knex } from 'knex';

/**
 * Makes unique names unique regardless of case, so two records cannot differ only by case.
 *
 * Feature type and feature property names are identifiers: they are looked up by their lowercase name and matched
 * against tarball types and property keys, so a type created as `Linework` could not be found. They are now stored
 * trimmed and lowercase:
 *
 * - Lowercases and trims every feature type and feature property name, active and retired.
 * - Rewrites the copies of a renamed feature type's name: `submission_feature.urn`
 *   (`urn:<submission>:<name>:<feature>`), and `security_scope.urn_feature_type` with the `scope_hash` derived from
 *   its URN. Feature types are renamed first, because the security scope URN trigger validates the new value against
 *   `feature_type.name`.
 * - Adds checks that names are stored normalized. With them, the existing active-name unique keys
 *   (`feature_type_nuk1`, `feature_property_nuk1`) are keys on the lowercase name.
 *
 * Security category, security rule and team names are display names, so their case is kept and their active-name
 * unique keys move to `lower(name)`, as tag and board names already are.
 *
 * Fails, naming them, when active records of any of these tables differ only by case (or, for identifiers,
 * surrounding whitespace). One of each must be retired or renamed first; the migration does not choose between them.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DO $$
    DECLARE
      _check record;
      _collisions text;
    BEGIN
      FOR _check IN
        SELECT *
        FROM (
          VALUES
            ('feature_type', 'lower(btrim(name))'),
            ('feature_property', 'lower(btrim(name))'),
            ('security_category', 'lower(name)'),
            ('security_rule', 'lower(name)'),
            ('team', 'lower(name)')
        ) AS checks(table_name, normalized_name)
      LOOP
        EXECUTE format(
          'SELECT string_agg(names, ''; '') FROM (
             SELECT string_agg(name, '', '' ORDER BY name) AS names
             FROM %I
             WHERE record_end_date IS NULL
             GROUP BY %s
             HAVING count(*) > 1
           ) collision',
          _check.table_name,
          _check.normalized_name
        ) INTO _collisions;

        IF _collisions IS NOT NULL THEN
          RAISE EXCEPTION 'Active % names differ only by case: %. Retire or rename one of each before migrating.',
            _check.table_name, _collisions;
        END IF;
      END LOOP;
    END $$;

    ----------------------------------------------------------------------------------------
    -- Feature types
    ----------------------------------------------------------------------------------------

    WITH renamed AS (
      UPDATE feature_type
      SET name = lower(btrim(name))
      WHERE name <> lower(btrim(name))
      RETURNING feature_type_id, name
    )
    UPDATE submission_feature sf
    SET urn = CONCAT('urn:', sf.submission_id, ':', renamed.name, ':', sf.submission_feature_id)
    FROM renamed
    WHERE sf.feature_type_id = renamed.feature_type_id;

    UPDATE security_scope
    SET
      urn_feature_type = lower(btrim(urn_feature_type)),
      scope_hash = encode(
        sha256(convert_to(CONCAT('urn:', urn_submission_id, ':', lower(btrim(urn_feature_type)), ':', urn_feature_id), 'UTF8')),
        'hex'
      )
    WHERE urn_feature_type <> '*'
      AND urn_feature_type <> lower(btrim(urn_feature_type));

    ALTER TABLE feature_type ADD CONSTRAINT feature_type_ck1 CHECK (name = lower(btrim(name)));

    COMMENT ON COLUMN feature_type.name IS 'The name of the feature_type record, stored trimmed and lowercase. Unique among active records.';

    ----------------------------------------------------------------------------------------
    -- Feature properties
    ----------------------------------------------------------------------------------------

    UPDATE feature_property
    SET name = lower(btrim(name))
    WHERE name <> lower(btrim(name));

    ALTER TABLE feature_property ADD CONSTRAINT feature_property_ck1 CHECK (name = lower(btrim(name)));

    COMMENT ON COLUMN feature_property.name IS 'The name of the feature_property record, stored trimmed and lowercase. Unique among active records.';

    ----------------------------------------------------------------------------------------
    -- Display names: unique among active records, ignoring case
    ----------------------------------------------------------------------------------------

    DROP INDEX security_category_nuk1;
    CREATE UNIQUE INDEX security_category_nuk1 ON security_category(lower(name)) WHERE record_end_date IS NULL;

    DROP INDEX security_rule_nuk1;
    CREATE UNIQUE INDEX security_rule_nuk1 ON security_rule(lower(name)) WHERE record_end_date IS NULL;

    DROP INDEX team_nuk1;
    CREATE UNIQUE INDEX team_nuk1 ON team(lower(name)) WHERE record_end_date IS NULL;

    COMMENT ON COLUMN security_category.name IS 'The name of the security_category record. Unique (case-insensitive) among active records.';
    COMMENT ON COLUMN security_rule.name IS 'The name of the security_rule record. Unique (case-insensitive) among active records.';
    COMMENT ON COLUMN team.name IS 'Unique (case-insensitive) name for the team among active records.';
  `);
}

/**
 * Restores case-sensitive unique keys and drops the normalized-name checks. Names are not restored to their original
 * case.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE feature_type DROP CONSTRAINT IF EXISTS feature_type_ck1;
    ALTER TABLE feature_property DROP CONSTRAINT IF EXISTS feature_property_ck1;

    DROP INDEX IF EXISTS security_category_nuk1;
    CREATE UNIQUE INDEX security_category_nuk1 ON security_category(name, (record_end_date IS NULL)) WHERE record_end_date IS NULL;

    DROP INDEX IF EXISTS security_rule_nuk1;
    CREATE UNIQUE INDEX security_rule_nuk1 ON security_rule(name, (record_end_date IS NULL)) WHERE record_end_date IS NULL;

    DROP INDEX IF EXISTS team_nuk1;
    CREATE UNIQUE INDEX team_nuk1 ON team(name, (record_end_date IS NULL)) WHERE record_end_date IS NULL;

    COMMENT ON COLUMN feature_type.name IS 'The name of the feature_type record.';
    COMMENT ON COLUMN feature_property.name IS 'The name of the feature_property record.';
    COMMENT ON COLUMN security_category.name IS 'The name of the security_category record.';
    COMMENT ON COLUMN security_rule.name IS 'The name of the security_rule record.';
    COMMENT ON COLUMN team.name IS 'Unique name for the team.';
  `);
}
