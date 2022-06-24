import SQL, { SQLStatement } from 'sql-template-strings';
import { getKnexQueryBuilder } from '../database/db';
import { BaseRepository } from './base-repository';

export interface ISpatialComponentsSearchCriteria {
  type?: string;
}

export class SpatialRepository extends BaseRepository {
  async findSpatialComponentsByCriteria(criteria: ISpatialComponentsSearchCriteria): Promise<any[]> {
    // const sqlStatement = SQL`
    //   SELECT
    //     *
    //   FROM
    //     submission_spatial_component
    //   WHERE
    //     1 = 1
    //   AND
    //     (
    //       (
    //         jsonb_path_query_first(spatial_component,'$.type') #>> '{}' = 'Feature'
    //         AND
    //         jsonb_path_query_first(spatial_component,'$.properties.type') #>> '{}' = ${criteria.type}
    //       )
    //       OR
    //       (
    //         jsonb_path_query_first(spatial_component,'$.type') #>> '{}' = 'FeatureCollection'
    //         AND
    //         jsonb_path_exists(spatial_component,'$.features[*] \? (@.properties.description == `;

    // sqlStatement.append(`"${criteria.type}"`);

    // sqlStatement.append(`)')
    //       )
    //     );
    // `);

    const queryBuilder = getKnexQueryBuilder().select().from('submission_spatial_component');

    if (criteria.type) {
      const sqlStatement1 = this._whereSpatialType('Feature');
      const sqlStatement2 = this._whereFeaturePropertyType(criteria.type);

      queryBuilder.or.where((qb) => {
        qb.and.whereRaw(sqlStatement1.sql, sqlStatement1.values);
        qb.and.whereRaw(sqlStatement2.sql, sqlStatement2.values);
      });

      const sqlStatement3 = this._whereSpatialType('FeatureCollection');
      const sqlStatement4 = this._whereFeatureCollectionPropertyType(criteria.type);

      queryBuilder.or.where((qb) => {
        qb.and.whereRaw(sqlStatement3.sql, sqlStatement3.values);
        qb.and.whereRaw(sqlStatement4.sql, sqlStatement4.values);
      });
    }

    const response = await this.connection.knex<any>(queryBuilder);

    return response.rows;
  }

  _whereSpatialType(type: string): SQLStatement {
    return SQL`jsonb_path_query_first(spatial_component,'$.type') #>> '{}' = ${type}`;
    // return SQL`select jsonb_path_query(spatial_component,'$.features[*]') from submission_spatial_component where jsonb_path_query_first(spatial_component,'$.type') #>> '{}' = 'FeatureCollection';`;
    // return SQL`select jsonb_path_query(spatial_component,'$.features[*] ? (@.properties.description == "Not provided")') from submission_spatial_component where jsonb_path_query_first(spatial_component,'$.type') #>> '{}' = 'FeatureCollection';`;
    // select * from submission_spatial_component where jsonb_path_query_first(spatial_component,'$.type') #>> '{}' = 'FeatureCollection' and jsonb_path_exists(spatial_component,'$.features[*] ? (@.properties.description == "Not provided")') ;
  }

  _whereFeaturePropertyType(type: string): SQLStatement {
    return SQL`jsonb_path_query_first(spatial_component,'$.properties.type') #>> '{}' = ${type}`;
  }

  _whereFeatureCollectionPropertyType(type: string): SQLStatement {
    // Unable to parameterize `type` due to its nesting inside the single quotes of the json patch argument.
    return SQL``.append(`jsonb_path_exists(spatial_component,'$.features[*] \\? (@.properties.type == "${type}")')`);
  }
}
