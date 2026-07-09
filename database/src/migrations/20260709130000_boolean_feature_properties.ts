import { Knex } from 'knex';

/**
 * Define the first `boolean`-typed feature properties.
 *
 * `feature_property_type` has carried a `boolean` entry, and `submission_feature_property_boolean` has
 * existed, since the property tables were created — but no `feature_property` ever used the type. That
 * left boolean expression predicates (`expression-evaluation.ts` -> `submission_feature_property_boolean`)
 * structurally reachable but impossible to exercise: no property could ever produce a row.
 *
 * Two properties are added where the flag carries real domain meaning rather than being a test hook:
 *   - `mortality.is_confirmed`  — whether the mortality was confirmed in the field (vs inferred from a
 *     collar mortality signal, which is the common false-positive in telemetry survival studies).
 *   - `capture.is_recapture`    — whether the animal had been captured previously in the same survey.
 *
 * Each property is registered in three places, matching `20260626150000_add_survey_feature_type`:
 *   1. `feature_property`               — the property pool entry carrying the `boolean` type.
 *   2. `feature_type_property`          — the assignment to its owning feature type.
 *   3. `blueprint_feature_type_property` — the active Blueprint assignment. Without this the indexer
 *      resolves no assignment and silently drops the value, and the composite FK on
 *      `submission_feature_property_boolean` could not be satisfied.
 *
 * `create_user` is omitted on the inserts; the audit trigger populates it from the session context,
 * matching the other seed migrations.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Add the boolean properties to the property pool.
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_property (feature_property_type_id, name, display_name, description)
    SELECT
      fpt.feature_property_type_id,
      property.name,
      property.display_name,
      property.description
    FROM feature_property_type fpt
    CROSS JOIN (VALUES
      (
        'is_confirmed',
        'Is confirmed',
        'Whether the mortality was confirmed in the field, as opposed to inferred from a collar mortality signal.'
      ),
      (
        'is_recapture',
        'Is recapture',
        'Whether the animal had been captured previously within the same survey.'
      )
    ) AS property(name, display_name, description)
    WHERE fpt.name = 'boolean'
      AND fpt.record_end_date IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM feature_property existing
        WHERE existing.name = property.name AND existing.record_end_date IS NULL
      );

    ----------------------------------------------------------------------------------------
    -- 2. Assign each property to its owning feature type.
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value, sort)
    SELECT ft.feature_type_id, fp.feature_property_id, false, 100
    FROM (VALUES
      ('mortality', 'is_confirmed'),
      ('capture', 'is_recapture')
    ) AS assignment(feature_type_name, feature_property_name)
    JOIN feature_type ft
      ON ft.name = assignment.feature_type_name AND ft.record_end_date IS NULL
    JOIN feature_property fp
      ON fp.name = assignment.feature_property_name AND fp.record_end_date IS NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property existing
      WHERE existing.feature_type_id = ft.feature_type_id
        AND existing.feature_property_id = fp.feature_property_id
        AND existing.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 3. Attach each assignment to every active Blueprint so the indexer resolves it.
    ----------------------------------------------------------------------------------------
    INSERT INTO blueprint_feature_type_property (
      blueprint_feature_type_id, feature_type_property_id, required_value, allow_multiple, sort
    )
    SELECT bft.blueprint_feature_type_id, ftp.feature_type_property_id, ftp.required_value, ftp.allow_multiple, ftp.sort
    FROM feature_type_property ftp
    JOIN feature_property fp
      ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
    JOIN blueprint_feature_type bft
      ON bft.feature_type_id = ftp.feature_type_id AND bft.record_end_date IS NULL
    WHERE fp.name IN ('is_confirmed', 'is_recapture')
      AND ftp.record_end_date IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM blueprint_feature_type_property existing
        WHERE existing.blueprint_feature_type_id = bft.blueprint_feature_type_id
          AND existing.feature_type_property_id = ftp.feature_type_property_id
          AND existing.record_end_date IS NULL
      );
  `);
}

/**
 * Remove the boolean properties and every row indexed through them.
 *
 * Indexed values are deleted before the assignments they reference: `submission_feature_property_boolean`
 * carries FKs to both `feature_type_property` and `blueprint_feature_type_property`.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DELETE FROM submission_feature_property_boolean
    WHERE feature_type_property_id IN (
      SELECT ftp.feature_type_property_id
      FROM feature_type_property ftp
      JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
      WHERE fp.name IN ('is_confirmed', 'is_recapture')
    );

    DELETE FROM blueprint_feature_type_property
    WHERE feature_type_property_id IN (
      SELECT ftp.feature_type_property_id
      FROM feature_type_property ftp
      JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
      WHERE fp.name IN ('is_confirmed', 'is_recapture')
    );

    DELETE FROM feature_type_property
    WHERE feature_property_id IN (
      SELECT feature_property_id FROM feature_property WHERE name IN ('is_confirmed', 'is_recapture')
    );

    DELETE FROM feature_property WHERE name IN ('is_confirmed', 'is_recapture');
  `);
}
