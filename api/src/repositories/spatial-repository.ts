import { Feature, FeatureCollection } from 'geojson';
import SQL, { SQLStatement } from 'sql-template-strings';
import { getKnexQueryBuilder } from '../database/db';
import { SPATIAL_COMPONENT_TYPE } from '../paths/dwc/spatial/search';
import { BaseRepository } from './base-repository';

export interface ISubmissionSpatialComponent {
  submission_spatial_component_id: number;
  submission_id: number;
  spatial_component: FeatureCollection;
  geometry: null;
  geography: string;
  secured_spatial_component: FeatureCollection;
  secured_geometry: null;
  secured_geography: string;
}

export interface ISubmissionSpatialComponentsCluster {
  spatial_component: FeatureCollection;
}

export interface ISpatialComponentsSearchCriteria {
  type: string[];
  boundary: Feature;
}

export class SpatialRepository extends BaseRepository {
  async getSpatialComponentsCountByCriteria(criteria: ISpatialComponentsSearchCriteria): Promise<{ count: number }> {
    const sqlStatement = SQL`
      select
        count(*) as count
      from
        submission_spatial_component
      where
        jsonb_path_exists(spatial_component, '$.features[*] ? (@.properties.type == "`
      .append(`${criteria.type[1]}`)
      .append(
        `")')
      and`
      )
      .append(this._whereBoundaryIntersects(criteria.boundary, 'geography'))
      .append(`;`);

    const response = await this.connection.sql<{ count: number }>(sqlStatement);

    return response.rows[0];
  }

  async findSpatialComponentsByCriteriaWithClustering(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialComponentsCluster[]> {
    const sqlStatement = SQL`
      with
        total_count as (
        select
          count(*) as count
        from
          submission_spatial_component
      )
      select
        json_build_object('type','FeatureCollection','features', array[public.ST_AsGeoJSON(tsub2, 'cluster_geom')::jsonb]) as spatial_component
      from (
        select
          ${SPATIAL_COMPONENT_TYPE.OCCURRENCE}::text as cluster_type,
          count(*) as cluster_count,
          public.ST_Centroid(public.ST_Union(geom)) AS cluster_geom`;

    if (criteria.type[1] === SPATIAL_COMPONENT_TYPE.OCCURRENCE) {
      sqlStatement.append(SQL`,array_agg(distinct(properties->>'taxon')) as cluster_taxon`);
    }

    sqlStatement
      .append(
        SQL`
        from (
          select
            public.ST_ClusterKMeans(geography::public.geometry, least(total_count.count, 3)::int) OVER() AS cluster_id,
            geography::public.geometry geom,
            spatial_component->'features'->0->'properties' as properties
          from
            submission_spatial_component,
            total_count
          where
            jsonb_path_exists(spatial_component, '$.features[*] ? (@.properties.type == "`
      )
      .append(`${criteria.type?.[1]}`)
      .append(
        SQL`")')
          and`
      )
      .append(this._whereBoundaryIntersects(criteria.boundary, 'geography')).append(SQL`
        ) tsub
        group by cluster_id
      ) tsub2;
    `);

    const response = await this.connection.sql<ISubmissionSpatialComponentsCluster>(sqlStatement);

    return response.rows;
  }

  async findSpatialComponentsByCriteria(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialComponent[]> {
    const queryBuilder = getKnexQueryBuilder().select().from('submission_spatial_component');

    if (criteria.type?.length) {
      // Append OR where clauses for each criteria.type
      queryBuilder.where((qb1) => {
        for (const type of criteria.type) {
          qb1.or.where((qb2) => {
            qb2.whereRaw(`jsonb_path_exists(spatial_component,'$.features[*] \\? (@.properties.type == "${type}")')`);
          });
        }
      });

      // Append AND where clause for criteria.boundary
      const sqlStatement1 = this._whereBoundaryIntersects(criteria.boundary, 'geography');
      queryBuilder.where((qb3) => {
        qb3.whereRaw(sqlStatement1.sql, sqlStatement1.values);
      });
    }

    const response = await this.connection.knex<ISubmissionSpatialComponent>(queryBuilder);

    return response.rows;
  }

  _whereBoundaryIntersects(boundary: Feature, geoColumn: string): SQLStatement {
    return SQL`
      public.ST_INTERSECTS(`.append(`${geoColumn}`).append(`,
        public.geography(
          public.ST_Force2D(
            public.ST_SetSRID(
              public.ST_Force2D(
                public.ST_GeomFromGeoJSON('${JSON.stringify(boundary.geometry)}')
              ),
              4326
            )
          )
        )
      )
    `);
  }
}
