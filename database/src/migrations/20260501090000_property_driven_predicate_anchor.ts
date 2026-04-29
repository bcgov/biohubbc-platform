import { Knex } from 'knex';

/**
 * Updates predicate anchors for the property-driven expression API.
 *
 * Predicates are now keyed by the required shared feature_property_id, while feature_type_property_id becomes the only
 * nullable predicate anchor. This lets search predicates target a property across feature types, while persisted
 * expression predicates can still be narrowed to one feature type property when needed.
 *
 * @param {Knex} knex - Knex database client.
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    --------------------------------------------------------------------------------
    -- PREDICATE PROPERTY ANCHOR
    --------------------------------------------------------------------------------

    -- Store the shared feature property directly on predicate

    ALTER TABLE predicate
      ADD COLUMN feature_property_id integer;

    -- Existing predicates were created against a concrete feature_type_property_id.
    -- Backfill the new shared property anchor from that relationship before enforcing
    -- the NOT NULL constraint.

    UPDATE predicate p
    SET feature_property_id = ftp.feature_property_id
    FROM feature_type_property ftp
    WHERE ftp.feature_type_property_id = p.feature_type_property_id;

    ALTER TABLE predicate
      ALTER COLUMN feature_property_id SET NOT NULL,
      ALTER COLUMN feature_type_property_id DROP NOT NULL,
      ADD CONSTRAINT predicate_fk3
        FOREIGN KEY (feature_property_id)
        REFERENCES feature_property(feature_property_id);

    CREATE INDEX predicate_idx4 ON predicate(feature_property_id);
    CREATE INDEX predicate_idx5
      ON predicate(feature_property_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE predicate IS 'Stable anchor table representing a reusable predicate against a feature property.';
    COMMENT ON COLUMN predicate.feature_property_id IS 'Foreign key to feature_property; identifies the shared property this predicate evaluates.';
    COMMENT ON COLUMN predicate.feature_type_property_id IS 'Optional foreign key to feature_type_property; narrows the predicate to one feature type property when supplied.';
  `);
}

/**
 * Restores the original feature-type-property anchored predicate model.
 *
 * This rollback is only valid while all predicate rows still have a concrete feature_type_property_id, because the
 * previous schema required that column for every predicate.
 *
 * @param {Knex} knex - Knex database client.
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    --------------------------------------------------------------------------------
    -- PREDICATE PROPERTY ANCHOR ROLLBACK
    --------------------------------------------------------------------------------

    -- Restore the table comments that described the original feature_type_property_id
    -- anchored model before dropping the shared feature_property_id column.
    COMMENT ON TABLE predicate IS 'Stable anchor table representing a reusable predicate against a feature type property.';
    COMMENT ON COLUMN predicate.feature_type_property_id IS 'Foreign key to feature_type_property; identifies the property this predicate evaluates.';

    -- Remove lookup support added for the property-driven predicate API.
    DROP INDEX IF EXISTS predicate_idx5;
    DROP INDEX IF EXISTS predicate_idx4;

    -- Reapply the original required feature_type_property_id anchor and remove the
    -- shared feature_property_id foreign key.
    ALTER TABLE predicate
      DROP CONSTRAINT IF EXISTS predicate_fk3,
      ALTER COLUMN feature_type_property_id SET NOT NULL,
      DROP COLUMN feature_property_id;
  `);
}
