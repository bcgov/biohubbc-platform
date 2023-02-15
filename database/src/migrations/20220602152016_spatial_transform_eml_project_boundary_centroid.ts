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

    insert into spatial_transform (name, description, record_effective_date, transform) values ('EML Dataset Boundaries Centroid', 'Extracts centroid from EML geographic coverage boundaries.', now(), $transform$with submissionmetadata as (select * from submission_metadata where submission_id = $1 and record_end_timestamp is null)
    , submissionuuid as (select uuid from submission, submissionmetadata  where submission.submission_id = submissionmetadata.submission_id)
      , coverages as (select c.cov_n, c.coverage from submissionmetadata, jsonb_path_query(eml_json_source, '$.**.geographicCoverage') with ordinality c(coverage, cov_n)), polys as (select c.cov_n, p.poly_n, p.points points from coverages c, jsonb_path_query(coverage, '$.**.datasetGPolygon[*].datasetGPolygonOuterGRing.gRingPoint') with ordinality p(points, poly_n))
      , latlongs as (select p.cov_n, p.poly_n, arr.point_n, arr.point->>'gRingLatitude' lat, arr.point->>'gRingLongitude' long from polys p, jsonb_array_elements(points) with ordinality arr(point, point_n))
      , points as (select ll.cov_n, ll.poly_n, ll.point_n, ll.long::float||' '||ll.lat::float point from latlongs ll)
      , polys2 as (select cov_n, poly_n, array_agg(point order by point_n) poly from points group by cov_n, poly_n)
      , string_polys as (select '('||array_to_string(poly, ',')||')' strp from polys2)
      , geojson_centroid as (select st_asgeojson(ST_Centroid(geography(ST_Multi('POLYGON('||string_agg(strp, ',')||')')))) centroid from string_polys)
      select jsonb_build_object('type', 'FeatureCollection'
        , 'features', jsonb_build_array(jsonb_build_object('type', 'Feature'
          , 'geometry', gc.centroid::json
          , 'properties', jsonb_build_object('type', 'Boundary Centroid'
            , 'datasetID', su.uuid
            , 'datasetTitle', jsonb_path_query(sm.eml_json_source, '$.**.dataset.title')
            ))
          )
        ) result_data
      from submissionmetadata sm, submissionuuid su, geojson_centroid gc
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
