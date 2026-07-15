import { Knex } from 'knex';

/**
 * Convert the sampling-period method technique property to a code reference.
 *
 * The property was originally inserted as `method_technique_id` with type `number`
 * (20260211000000_fix_feature_properties_and_assignments). SIMS now publishes the sampling period's
 * method technique as a code reference (`code::method_technique::<id>`) resolved against a survey-scoped
 * `method_technique` codeset, so the property is:
 *   - renamed `method_technique_id` -> `method_technique` (it no longer carries a raw id), and
 *   - retyped `number` -> `code`.
 *
 * The `feature_type_property` assignment on `sample_period` is unaffected; it references the property by
 * `feature_property_id`, which does not change.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    UPDATE feature_property
    SET
      name = 'method_technique',
      display_name = 'Method technique',
      description = 'The sampling or method technique, as a code reference.',
      feature_property_type_id = (
        SELECT feature_property_type_id FROM feature_property_type WHERE name = 'code' AND record_end_date IS NULL
      )
    WHERE name = 'method_technique_id'
      AND record_end_date IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    UPDATE feature_property
    SET
      name = 'method_technique_id',
      display_name = 'Method technique identifier',
      description = 'Identifier of the sampling or method technique.',
      feature_property_type_id = (
        SELECT feature_property_type_id FROM feature_property_type WHERE name = 'number' AND record_end_date IS NULL
      )
    WHERE name = 'method_technique'
      AND record_end_date IS NULL;
  `);
}
