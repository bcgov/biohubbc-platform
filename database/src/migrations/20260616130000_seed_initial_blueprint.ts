import { Knex } from 'knex';

/**
 * Seeds the initial default Blueprint from the current `feature_type_property` configuration so that
 * indexing behavior is preserved once property assignment moves to the Blueprint tables.
 *
 * The seed (idempotent — skipped if any active Blueprint already exists):
 * 1. Creates one initial Blueprint: version 1, `is_default = true`, `record_effective_date = now()`,
 *    `record_end_date` null, `parent_blueprint_id` null — i.e. immediately available for indexing.
 * 2. Adds one `blueprint_feature_type` row for each active `feature_type` (carrying its `sort`).
 * 3. Adds one `blueprint_feature_type_property` row for each active `feature_type_property`, linking
 *    the seeded `blueprint_feature_type` row (via its `feature_type_id`) to the `feature_type_property`
 *    pool entry and copying its `required_value`, `allow_multiple`, and `sort`.
 *
 * `create_user` is intentionally omitted on the inserts; the table audit trigger populates it from
 * the session context (falling back to the DATABASE system user), matching other seed migrations.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Seed the initial default Blueprint and its feature-type / property assignments.
    -- A single chained statement guarantees all three inserts share the one new blueprint_id,
    -- and the data-modifying CTEs always execute even when not referenced by the final query.
    ----------------------------------------------------------------------------------------
    WITH new_blueprint AS (
      INSERT INTO blueprint (version_number, name, description, is_default, parent_blueprint_id, record_effective_date)
      SELECT
        1,
        'Initial Blueprint',
        'Seeded from the feature_type_property configuration to preserve existing indexing behavior.',
        true,
        NULL,
        now()
      -- Idempotent: only seed when no active Blueprint exists.
      WHERE NOT EXISTS (SELECT 1 FROM blueprint WHERE record_end_date IS NULL)
      RETURNING blueprint_id
    ),
    seed_feature_types AS (
      INSERT INTO blueprint_feature_type (blueprint_id, feature_type_id, sort)
      SELECT nb.blueprint_id, ft.feature_type_id, ft.sort
      FROM new_blueprint nb
      CROSS JOIN feature_type ft
      WHERE ft.record_end_date IS NULL
      RETURNING blueprint_feature_type_id, feature_type_id
    )
    -- Attach each active feature_type_property to the seeded blueprint_feature_type row for its
    -- feature type. The join naturally excludes any active property whose feature type was ended
    -- (and therefore has no blueprint_feature_type row to reference).
    INSERT INTO blueprint_feature_type_property (
      blueprint_feature_type_id, feature_type_property_id, required_value, allow_multiple, sort
    )
    SELECT
      sft.blueprint_feature_type_id,
      ftp.feature_type_property_id,
      COALESCE(ftp.required_value, false),
      COALESCE(ftp.allow_multiple, false),
      ftp.sort
    FROM feature_type_property ftp
    JOIN seed_feature_types sft ON sft.feature_type_id = ftp.feature_type_id
    WHERE ftp.record_end_date IS NULL;
  `);
}

/**
 * Removes the seeded initial Blueprint and its assignments. Children are deleted first because they
 * carry foreign keys up the chain: `blueprint_feature_type_property` references
 * `blueprint_feature_type`, which references `blueprint`.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DELETE FROM blueprint_feature_type_property
    WHERE blueprint_feature_type_id IN (
      SELECT bft.blueprint_feature_type_id
      FROM blueprint_feature_type bft
      JOIN blueprint b ON b.blueprint_id = bft.blueprint_id
      WHERE b.version_number = 1 AND b.is_default = true
    );

    DELETE FROM blueprint_feature_type
    WHERE blueprint_id IN (SELECT blueprint_id FROM blueprint WHERE version_number = 1 AND is_default = true);

    DELETE FROM blueprint
    WHERE version_number = 1 AND is_default = true;
  `);
}
