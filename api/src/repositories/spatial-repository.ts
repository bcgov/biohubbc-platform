import { Feature, FeatureCollection } from 'geojson';
import SQL, { SQLStatement } from 'sql-template-strings';
import { getKnex, getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

export interface IInsertSpatialTransform {
  name: string;
  description: string;
  notes: string;
  transform: string;
}

export interface IGetSpatialTransformRecord {
  spatial_transform_id: number;
  name: string;
  description: string | null;
  notes: string | null;
  transform: string;
}

export interface IGetSecurityTransformRecord {
  security_transform_id: number;
  name: string;
  description: string | null;
  notes: string | null;
  transform: string;
}

export interface ITransformSpatialRow {
  result_data: FeatureCollection;
}

export interface ITransformSecureRow {
  spatial_component: {
    spatial_data: FeatureCollection;
    submission_spatial_component_id: number;
  };
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
  datasetID?: string[];
  boundary: Feature;
}

export interface ISubmissionSpatialSearchResponseRow {
  spatial_component: {
    spatial_data: FeatureCollection;
    submission_spatial_component_id: number;
  };
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
   * get spatial transform records
   *
   * @param
   * @return {*}  {Promise<IGetSpatialTransformRecord>}
   * @memberof SpatialRepository
   */
  async getSpatialTransformRecords(): Promise<IGetSpatialTransformRecord[]> {
    const sqlStatement = SQL`
      SELECT
        spatial_transform_id,
        name,
        description,
        notes,
        transform
      FROM
        spatial_transform;
    `;

    const response = await this.connection.sql<IGetSpatialTransformRecord>(sqlStatement);

    return response.rows;
  }

  /**
   *get security transform records
   *
   * @return {*}  {Promise<IGetSecurityTransformRecord[]>}
   * @memberof SpatialRepository
   */
  async getSecurityTransformRecords(): Promise<IGetSecurityTransformRecord[]> {
    const sqlStatement = SQL`
      SELECT
        security_transform_id,
        name,
        description,
        notes,
        transform
      FROM
        security_transform;
    `;

    const response = await this.connection.sql<IGetSecurityTransformRecord>(sqlStatement);

    return response.rows;
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
          'rowCount was null or undefined, expected rowCount >= 1'
        ]
      );
    }
    return response.rows[0];
  }

  /**
   * Insert record of transform id used for submission security component record
   *
   * @param {number} securityTransformId
   * @param {number} submissionSpatialComponentId
   * @return {*}  {Promise<{ spatial_transform_submission_id: number }>}
   * @memberof SpatialRepository
   */
  async insertSecurityTransformSubmissionRecord(
    securityTransformId: number,
    submissionSpatialComponentId: number
  ): Promise<{ security_transform_submission_id: number }> {
    const sqlStatement = SQL`
        INSERT INTO security_transform_submission (
          security_transform_id,
          submission_spatial_component_id
        ) VALUES (
          ${securityTransformId},
          ${submissionSpatialComponentId}
        )
        RETURNING
          security_transform_submission_id;
      `;

    const response = await this.connection.sql<{ security_transform_submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError(
        'Failed to insert spatial transform submission id and submission spatial component id',
        [
          'SpatialRepository->insertSecurityTransformSubmissionRecord',
          'rowCount was null or undefined, expected rowCount >= 1'
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
   * @return {*}  {Promise<ITransformRow[]>}
   * @memberof SpatialRepository
   */
  async runSpatialTransformOnSubmissionId(submissionId: number, transform: string): Promise<ITransformSpatialRow[]> {
    const response = await this.connection.query(transform, [submissionId]);

    if (response.rowCount <= 0) {
      throw new ApiExecuteSQLError('Failed to run transform on submission id', [
        'SpatialRepository->runSpatialTransformOnSubmissionId',
        'rowCount was null or undefined, expected rowCount >= 1'
      ]);
    }

    return response.rows;
  }

  /**
   * Run Security Transform with transform string on submissionId
   *
   * @param {number} submissionId
   * @param {string} transform
   * @return {*}  {Promise<ITransformRow[]>}
   * @memberof SpatialRepository
   */
  async runSecurityTransformOnSubmissionId(submissionId: number, transform: string): Promise<ITransformSecureRow[]> {
    const response = await this.connection.query(transform, [submissionId]);

    return response.rows;
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

  /**
   * Insert given transformed data into Spatial Component Table
   *
   * @param {number} submissionId
   * @param {Feature[]} transformedData
   * @return {*}  {Promise<{ submission_spatial_component_id: number }>}
   * @memberof SpatialRepository
   */
  async updateSubmissionSpatialComponentWithSecurity(
    submissionSpatialComponentId: number,
    transformedData: object
  ): Promise<{ submission_spatial_component_id: number }> {
    const sqlStatement = SQL`
        UPDATE
          submission_spatial_component
        SET
          secured_spatial_component =  ${transformedData}
        WHERE
          submission_spatial_component_id = ${submissionSpatialComponentId}
        RETURNING
          submission_spatial_component_id;
      `;

    const response = await this.connection.sql<{ submission_spatial_component_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission spatial component details', [
        'SpatialRepository->updateSubmissionSpatialComponentWithSecurity',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
    return response.rows[0];
  }

  /**
   * Query builder to find spatial component by given criteria
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialSearchResponseRow[]>}
   * @memberof SpatialRepository
   */
  async findSpatialComponentsByCriteria(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialSearchResponseRow[]> {
    const knex = getKnex();
    const queryBuilder = knex
      .queryBuilder()
      .select(
        knex.raw(
          "jsonb_build_object('submission_spatial_component_id', submission_spatial_component_id, 'spatial_data', spatial_component) spatial_component"
        )
      )
      .from('submission_spatial_component');

    if (criteria.type?.length) {
      // Append OR where clauses for each criteria.type
      queryBuilder.where((qb1) => {
        for (const type of criteria.type) {
          qb1.or.where((qb2) => {
            qb2.whereRaw(`jsonb_path_exists(spatial_component,'$.features[*] \\? (@.properties.type == "${type}")')`);
          });
        }
      });
    }

    if (criteria.datasetID?.length) {
      // Append AND where clause for criteria.datasetID
      queryBuilder.where((qb3) => {
        qb3.whereRaw(
          `submission_id in (select submission_id from submission where uuid in (${
            "'" + criteria.datasetID?.join("','") + "'"
          }))`
        );
      });
    }

    // Append AND where clause for criteria.boundary
    const sqlStatement1 = this._whereBoundaryIntersects(criteria.boundary, 'geography');
    queryBuilder.where((qb4) => {
      qb4.whereRaw(sqlStatement1.sql, sqlStatement1.values);
    });

    const response = await this.connection.knex<ISubmissionSpatialSearchResponseRow>(queryBuilder);

    return response.rows;
  }

  /**
   * Query spatial components by given submission ID
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialComponent[]>}
   * @memberof SpatialRepository
   */
  async findSpatialMetadataBySubmissionId(
    submission_spatial_component_id: number
  ): Promise<ISubmissionSpatialComponent> {
    const queryBuilder = getKnexQueryBuilder()
      .select()
      .from('submission_spatial_component')
      .where({ submission_spatial_component_id });

    const spatialComponentResponse = await this.connection.knex<ISubmissionSpatialComponent>(queryBuilder);

    return spatialComponentResponse.rows[0];
  }

  async deleteSpatialComponentsBySubmissionId(submission_id: number): Promise<{ submission_id: number }[]> {
    const sqlStatement = SQL`
      DELETE FROM
        submission_spatial_component
      WHERE
        submission_id=${submission_id}
      RETURNING
        submission_id;
    ;`;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    return response.rows;
  }

  async deleteSpatialComponentsSpatialTransformRefsBySubmissionId(
    submission_id: number
  ): Promise<{ submission_id: number }[]> {
    const sqlStatement = SQL`
      DELETE FROM
        spatial_transform_submission
      WHERE
        submission_spatial_component_id IN (
          SELECT
            submission_spatial_component_id
          FROM
            submission_spatial_component
          WHERE
            submission_id=${submission_id}
        )
      RETURNING
        ${submission_id};
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    return response.rows;
  }

  async deleteSpatialComponentsSecurityTransformRefsBySubmissionId(
    submission_id: number
  ): Promise<{ submission_id: number }[]> {
    const sqlStatement = SQL`
      DELETE FROM
        security_transform_submission
      WHERE
        submission_spatial_component_id IN (
          SELECT
            submission_spatial_component_id
          FROM
            submission_spatial_component
          WHERE
            submission_id=${submission_id}
        )
      RETURNING
        ${submission_id};
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

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
