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
    await knex.raw(insertSpatialTransform());
  } else {
    await knex.raw(updateSpatialTransform());
  }
}

const checkTransformExists = () => `
  SELECT
    spatial_transform_id
  FROM
    spatial_transform
  WHERE
    name = 'DwC Occurrences';
`;

const insertSpatialTransform = () => `
  INSERT into spatial_transform
    (name, description, record_effective_date, transform)
  VALUES (
    'DwC Occurrences', 'Extracts occurrences and properties from DwC JSON source.', now(),${transformString}
  );
`;

const updateSpatialTransform = () => `
  UPDATE
    spatial_transform SET transform = ${transformString}
  WHERE
    name = 'DwC Occurrences';
`;

const transformString = `
  $transform$
    with w_submission_observation as (
        select
            *
        from
            submission_observation
        where
            submission_id = ?
            and record_end_timestamp is null
    ),
    w_occurrences as (
        select
            submission_observation_id,
            occs
        from
            w_submission_observation,
            jsonb_path_query(darwin_core_source, '$.occurrence') occs
    ),
    w_occurrence as (
        select
            submission_observation_id,
            jsonb_array_elements(occs) occ
        from
            w_occurrences
    ),
    w_events as (
        select
            evns
        from
            w_submission_observation,
            jsonb_path_query(darwin_core_source, '$.event') evns
    ),
    w_event as (
        select
            jsonb_array_elements(evns) evn
        from
            w_events
    ),
    w_locations as (
        select
            locs
        from
            w_submission_observation,
            jsonb_path_query(darwin_core_source, '$.location') locs
    ),
    w_location as (
        select
            jsonb_array_elements(locs) loc
        from
            w_locations
    ),
    w_location_coord as (
        select
            coalesce(st_x(pt), 0) x,
            coalesce(st_y(pt), 0) y,
            loc
        from
            w_location,
            ST_SetSRID(
                ST_MakePoint(
                    (nullif(loc ->> 'decimalLongitude', '')) :: float,
                    (nullif(loc ->> 'decimalLatitude', '')) :: float
                ),
                4326
            ) pt
    ),
    w_normal as (
        select
            distinct o.submission_observation_id,
            o.occ,
            ec.*,
            e.evn
        from
            w_occurrence o
            left outer join w_location_coord ec on (ec.loc -> 'eventID' = o.occ -> 'eventID')
            left outer join w_event e on (e.evn -> 'eventID' = o.occ -> 'eventID')
    )
    select
        jsonb_build_object(
            'type',
            'FeatureCollection',
            'features',
            jsonb_build_array(
                jsonb_build_object(
                    'type',
                    'Feature',
                    'geometry',
                    jsonb_build_object(
                        'type',
                        'Point',
                        'coordinates',
                        json_build_array(n.x, n.y)
                    ),
                    'properties',
                    jsonb_build_object(
                        'type',
                        'Occurrence',
                        'dwc',
                        jsonb_build_object(
                            'type',
                            'PhysicalObject',
                            'basisOfRecord',
                            'Occurrence',
                            'datasetID',
                            n.submission_observation_id,
                            'occurrenceID',
                            n.occ -> 'occurrenceID',
                            'sex',
                            n.occ -> 'sex',
                            'lifeStage',
                            n.occ -> 'lifeStage',
                            'taxonID',
                            n.occ -> 'taxonID',
                            'vernacularName',
                            n.occ -> 'vernacularName',
                            'scientificName',
                            n.occ -> 'scientificName',
                            'occurrenceRemarks',
                            n.occ -> 'occurrenceRemarks',
                            'individualCount',
                            n.occ -> 'individualCount',
                            'eventDate',
                            n.evn -> 'eventDate',
                            'verbatimSRS',
                            n.loc -> 'verbatimSRS',
                            'verbatimCoordinates',
                            n.loc -> 'verbatimCoordinates'
                        )
                    )
                )
            )
        ) result_data
    from
        w_normal n;
  $transform$
`;
