import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const DB_SCHEMA_DAPI_V1 = process.env.DB_SCHEMA_DAPI_V1;

/**
 * Add spatial transform
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SCHEMA '${DB_SCHEMA}';
    SET SEARCH_PATH = ${DB_SCHEMA}, ${DB_SCHEMA_DAPI_V1};

    INSERT INTO
      security_transform
      (name, description, record_effective_date, transform)
    VALUES
      ('DwC Occurrences', 'Assigns Persecution and Harm Rules', now(),
      $transform$
        WITH with_spatial_component AS
          (SELECT spatial_component,
          submission_spatial_component_id from submission_spatial_component where submission_id = ? and jsonb_path_exists(spatial_component,'$.features[*] \\? (@.properties.type == "Occurrence")'))
          SELECT jsonb_build_object(
            'submission_spatial_component_id',
            wsc.submission_spatial_component_id,
            'spatial_data',
              CASE
                WHEN
                  wsc.spatial_component->'features'->0->'properties'->'dwc'->'associatedTaxa' <@ json_build_array('Mountain Goat', 'Bighorn Sheep', 'Thinhorn Sheep' , 'Spotted Owl')::jsonb
                THEN
                    json_build_object()
                ELSE
                  NULL
                END
            ) spatial_component
          FROM with_spatial_component wsc;
        $transform$);
  `);
}

/**
 * Not used.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
