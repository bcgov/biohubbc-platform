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

    insert into spatial_transform (
      name, 
      description, 
      record_effective_date, 
      transform
    ) values (
      'EML Dataset Boundaries', 
      'Extracts EML dataset geographic coverage boundaries and properties.', 
      now(), 
      $transform$
        with submissionmetadata as (
          select 
            eml_json_source 
          from 
            submission_metadata 
          where 
            submission_id = ? 
          and 
            record_end_timestamp is null
        )
        , project_coverage as (
          select 
            c.cov_n, 
            'project' project_type, 
            c.coverage 
          from 
            submissionmetadata, 
            jsonb_path_query(eml_json_source, '$.**.project.studyAreaDescription.**.geographicCoverage') with ordinality c(coverage, cov_n)
        )
        , related_project_coverages as (
            select 
              c.cov_n, 
              'relatedProject' project_type, 
              c.coverage 
            from
              submissionmetadata, 
              jsonb_path_query(eml_json_source, '$.**.relatedProject.studyAreaDescription.**.geographicCoverage') with ordinality c(coverage, cov_n)
        )
        , descriptions as (
            select 
              cov_n, 
              project_type, 
              coverage->'geographicDescription' description 
            from 
              project_coverage union select cov_n, project_type, coverage->'geographicDescription' description from related_project_coverages
        )
        , coverages as (
            select 
              * 
            from 
              project_coverage union select * from related_project_coverages
        )
        , polys as (
            select 
              c.cov_n, 
              c.project_type, 
              p.poly_n, 
              p.points points 
            from 
              coverages c, 
              jsonb_path_query(coverage, '$.**.datasetGPolygon[*].datasetGPolygonOuterGRing.gRingPoint') with ordinality p(points, poly_n)
        )
        , latlongs as (
            select 
              p.cov_n, 
              p.project_type, 
              p.poly_n, 
              arr.point_n, 
              arr.point->>'gRingLatitude' lat, 
              arr.point->>'gRingLongitude' long 
            from 
              polys p, 
              jsonb_array_elements(points) with ordinality arr(point, point_n)
        )
        , points as (
            select 
              ll.cov_n, 
              ll.project_type, 
              ll.poly_n, 
              ll.point_n, 
              json_build_array(ll.long::float, ll.lat::float) point from latlongs ll
        )
        , polys2 as (
            select 
              cov_n, 
              project_type, 
              poly_n, 
              jsonb_agg(point order by point_n) poly from points group by cov_n, project_type, poly_n
        )
        , multipoly as (
            select 
              cov_n, 
              project_type, 
              jsonb_agg(poly) mpoly 
            from 
              polys2 
            group by 
              project_type,
              cov_n
        )
        , features as (
            select 
              json_build_object(
                'type','Feature',
                'geometry', json_build_object(
                  'type','Polygon',
                  'coordinates', f.mpoly
                ), 
                'properties', json_build_object(
                  'type', 'Boundary', 
                  'description', f.description, 
                  'project type', f.project_type
                )
              ) feature 
            from 
              (
                select 
                  d.description, 
                  m.mpoly, 
                  m.project_type 
                from 
                  multipoly m, 
                  descriptions d 
                where 
                  d.cov_n = m.cov_n 
                and 
                  d.project_type = m.project_type
              ) f
        )
        select 
          json_build_object('type','FeatureCollection','features',jsonb_agg(feature)) result_data 
        from 
          features
      $transform$
    );
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
