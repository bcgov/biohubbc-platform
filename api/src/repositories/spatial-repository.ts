import { Feature } from 'geojson';
import SQL, { SQLStatement } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ILatLong, IUTM, parseLatLongString, parseUTMString } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

export interface IInsertSpatialTransform {
  name: string;
  description: string;
  notes: string;
  transform: string;
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

  async runSpatialTransformOnSubmissionId(
    submissionId: number,
    transform: string
  ): Promise<{ json_build_object: { type: string; features: Feature[] } }> {
    const response = await this.connection.query(transform, [submissionId]);

    console.log('response', response);

    return response.rows[0];
  }

  async insertSubmissionSpatialComponent(submissionId: number, transformedData: any): Promise<any> {
    console.log('transformedData', transformedData);

    const sqlStatement = SQL`
      INSERT INTO submission_spatial_component (
        submission_id,
        spatial_component,
        geography
      ) VALUES (
        ${submissionId},
        ${transformedData}
    `;

    const utm = parseUTMString(transformedData[0].geometry.coordinates.toString() || '');
    const latLong = parseLatLongString(transformedData[0].geometry.coordinates.toString() || '');
    console.log('utm', utm);
    console.log('latLong', latLong);

    if (utm) {
      // transform utm string into point, if it is not null
      sqlStatement.append(',');
      sqlStatement.append(this.getGeographySqlFromUtm(utm));
    } else if (latLong) {
      // transform latLong string into point, if it is not null
      sqlStatement.append(',');
      sqlStatement.append(this.getGeographySqlFromLatLong(latLong));
    } else {
      // insert null geography
      sqlStatement.append(',');
      sqlStatement.append('null');
    }

    sqlStatement.append(`
    ) RETURNING
      submission_spatial_component_id;
    `);

    console.log('sqlStatement', sqlStatement);

    const response = await this.connection.sql<{ submission_spatial_component_id: number }>(sqlStatement);

    console.log('response', response);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission spatial component details', [
        'SpatialRepository->insertSubmissionSpatialComponent',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
    return response.rows[0];
  }

  getGeographySqlFromUtm(utm: IUTM): SQLStatement {
    return SQL`
      public.ST_Transform(
        public.ST_SetSRID(
          public.ST_MakePoint(${utm.easting}, ${utm.northing}),
          ${utm.zone_srid}
        ),
        4326
      )`;
  }

  getGeographySqlFromLatLong(latLong: ILatLong): SQLStatement {
    return SQL`
      public.ST_Transform(
        public.ST_SetSRID(
          public.ST_MakePoint(${latLong.long}, ${latLong.lat}),
          4326
        ),
        4326
      )`;
  }
}
