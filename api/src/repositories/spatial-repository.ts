import { Feature, FeatureCollection } from 'geojson';
import SQL, { SQLStatement } from 'sql-template-strings';
import { getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

export interface IInsertSpatialTransform {
  name: string;
  description: string;
  notes: string;
  transform: string;
}

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
  /**
   * Insert new spatial transform record
   *
   * @param {IInsertSpatialTransform} spatialTransformDetails
   * @return {*}  {Promise<{ spatial_transform_id: number }>}
   * @memberof SpatialRepository
   */
  async insertSpatialTransform(
    spatialTransformDetails: IInsertSpatialTransform
  ): Promise<{ spatial_transform_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO spatial_transform (
        name,
        description,
        notes,
        transform
      ) VALUES (
        ${spatialTransformDetails.name},
        ${spatialTransformDetails.description},
        ${spatialTransformDetails.notes},
        ${spatialTransformDetails.transform}
      )
      RETURNING
        spatial_transform_id;
    `;

    const response = await this.connection.sql<{ spatial_transform_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert spatial transform details', [
        'SpatialRepository->insertSpatialTransform',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
    return response.rows[0];
  }

  /**
   * get spatial transform from id
   *
   * @param {number} spatialTransformId
   * @return {*}  {Promise<{ transform: string }>}
   * @memberof SpatialRepository
   */
  async getSpatialTransformBySpatialTransformId(spatialTransformId: number): Promise<{ transform: string }> {
    const sqlStatement = SQL`
      SELECT
        transform
      FROM
        spatial_transform
      WHERE
        spatial_transform_id = ${spatialTransformId};
    `;

    const response = await this.connection.sql<{ transform: string }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get spatial transform', [
        'SpatialRepository->getSpatialTransformBySpatialTransformId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert record of transform id used for submission spatial component record
   *
   * @param {number} spatialTransformId
   * @param {number} submissionSpatialComponentId
   * @return {*}  {Promise<{ spatial_transform_submission_id: number }>}
   * @memberof SpatialRepository
   */
  async insertSpatialTransformSubmissionRecord(
    spatialTransformId: number,
    submissionSpatialComponentId: number
  ): Promise<{ spatial_transform_submission_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO spatial_transform_submission (
        spatial_transform_id,
        submission_spatial_component_id
      ) VALUES (
        ${spatialTransformId},
        ${submissionSpatialComponentId}
      )
      RETURNING
        spatial_transform_submission_id;
    `;

    const response = await this.connection.sql<{ spatial_transform_submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError(
        'Failed to insert spatial transform submission id and submission spatial component id',
        [
          'SpatialRepository->insertSpatialTransformSubmissionRecord',
          'rowCount was null or undefined, expected rowCount = 1'
        ]
      );
    }
    return response.rows[0];
  }

  /**
   * Run Spatial Transform with transform string on submissionId
   *
   * @param {number} submissionId
   * @param {string} transform
   * @return {*}  {Promise<FeatureCollection>}
   * @memberof SpatialRepository
   */
  async runSpatialTransformOnSubmissionId(submissionId: number, transform: string): Promise<FeatureCollection> {
    const response = await this.connection.query(transform, [submissionId]);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to run transform on submission id', [
        'SpatialRepository->runSpatialTransformOnSubmissionId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].json_build_object;
    //TODO: subject to change .json_build_object name
  }

  /**
   * Insert given transformed data into Spatial Component Table
   *
   * @param {number} submissionId
   * @param {Feature[]} transformedData
   * @return {*}  {Promise<{ submission_spatial_component_id: number }>}
   * @memberof SpatialRepository
   */
  async insertSubmissionSpatialComponent(
    submissionId: number,
    transformedData: FeatureCollection
  ): Promise<{ submission_spatial_component_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_spatial_component (
        submission_id,
        spatial_component,
        geography
      ) VALUES (
        ${submissionId},
        ${JSON.stringify(transformedData)}
    `;

    if (transformedData.features && transformedData.features.length > 0) {
      const geoCollection = generateGeometryCollectionSQL(transformedData.features);

      sqlStatement.append(SQL`
        ,public.geography(
          public.ST_Force2D(
            public.ST_SetSRID(
      `);

      sqlStatement.append(geoCollection);

      sqlStatement.append(SQL`
        , 4326)))
      `);
    } else {
      sqlStatement.append(SQL`
        ,null
      `);
    }

    sqlStatement.append(SQL`
      )
      RETURNING
        submission_spatial_component_id;
    `);

    const response = await this.connection.sql<{ submission_spatial_component_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission spatial component details', [
        'SpatialRepository->insertSubmissionSpatialComponent',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
    return response.rows[0];
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