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
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SCHEMA '${DB_SCHEMA}';
    SET SEARCH_PATH = ${DB_SCHEMA}, ${DB_SCHEMA_DAPI_V1};
  `);

  const response = await knex.raw(checkTransformExists());

  if (!response?.rows?.[0]) {
    await knex.raw(insertSecurityTransform());
  } else {
    await knex.raw(updateSecurityTransform());
  }
}

const checkTransformExists = () => `
  SELECT
    security_transform_id
  FROM
    security_transform
  WHERE
    name = 'DwC Occurrences';
`;

const insertSecurityTransform = () => `
  INSERT into security_transform
    (persecution_or_harm_id, name, description, transform)
  VALUES (
    1, 'DwC Occurrences', 'Assigns Persecution and Harm Rules', ${transformString}
  );
`;

const updateSecurityTransform = () => `
  UPDATE
    security_transform 
  SET 
    transform = ${transformString}
  WHERE
    name = 'DwC Occurrences';
`;

const transformString = `
  $transform$
    WITH submissionobservation AS (
      select
        submission_observation_id
      from
        submission_observation
      where
        submission_id = ?
        and record_end_timestamp is null
    ),
    with_spatial_component AS (
      SELECT
        spatial_component,
        submission_spatial_component_id
      FROM
        submission_spatial_component ssc,
        submissionobservation
      WHERE
        ssc.submission_observation_id = submissionobservation.submission_observation_id
        AND jsonb_path_exists(
          spatial_component,
          '$.features[*] \\? (@.properties.type == "Occurrence")'
        )
    )
    SELECT
      jsonb_build_object(
        'submission_spatial_component_id',
        wsc.submission_spatial_component_id,
        'spatial_data',
        CASE
          WHEN json_build_array(
            Lower(
              wsc.spatial_component -> 'features' -> 0 -> 'properties' -> 'dwc' ->> 'taxonID'
            )
          ) :: jsonb <@ json_build_array(
            'mountain goat',
            'bighorn sheep',
            'thinhorn sheep',
            'spotted owl',
            'm-oram',
            'm-ovca',
            'm-ovca-ca',
            'm-ovda',
            'm-ovda-da',
            'm-ovda-st',
            'b-spow',
            'b-spow-ca'
          ) :: jsonb THEN json_build_object()
          ELSE NULL
        END
      ) spatial_component
    FROM
      with_spatial_component wsc;
  $transform$
`;
