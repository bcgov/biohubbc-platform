import { Feature, FeatureCollection } from 'geojson';
import SQL, { SQLStatement } from 'sql-template-strings';
import { getKnexQueryBuilder } from '../database/db';
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

export interface ISpatialComponentsSearchCriteria {
  type: string[];
  boundary: Feature;
}

export class SpatialRepository extends BaseRepository {
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
