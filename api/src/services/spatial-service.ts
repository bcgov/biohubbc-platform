import { GeoJsonProperties } from 'geojson';
import { SPATIAL_COMPONENT_TYPE } from '../constants/spatial';
import { IDBConnection } from '../database/db';
import {
  IGetSecurityTransformRecord,
  IGetSpatialTransformRecord,
  IInsertSpatialTransform,
  ISpatialComponentsSearchCriteria,
  ISubmissionSpatialSearchResponseRow,
  SpatialRepository
} from '../repositories/spatial-repository';
import { DBService } from './db-service';
import { Srid } from './geo-service';
import { UserService } from './user-service';

export class SpatialService extends DBService {
  spatialRepository: SpatialRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.spatialRepository = new SpatialRepository(connection);
  }

  /**
   * Insert new spatial transform record
   *
   * @param {IInsertSpatialTransform} spatialTransformDetails
   * @return {*}  {Promise<{ spatial_transform_id: number }>}
   * @memberof SpatialService
   */
  async insertSpatialTransform(
    spatialTransformDetails: IInsertSpatialTransform
  ): Promise<{ spatial_transform_id: number }> {
    return this.spatialRepository.insertSpatialTransform(spatialTransformDetails);
  }

  /**
   * get spatial transform record from name
   *
   * @param {string} spatialTransformName
   * @return {*}  {Promise<IGetSpatialTransformRecord>}
   * @memberof SpatialService
   */
  async getSpatialTransformRecords(): Promise<IGetSpatialTransformRecord[]> {
    return this.spatialRepository.getSpatialTransformRecords();
  }

  /**
   * get security transform record from name
   *
   * @param {string} spatialTransformName
   * @return {*}  {Promise<IGetSpatialTransformRecord>}
   * @memberof SpatialService
   */
  async getSecurityTransformRecords(): Promise<IGetSecurityTransformRecord[]> {
    return this.spatialRepository.getSecurityTransformRecords();
  }

  /**
   * Insert record of transform id used for submission spatial component record
   *
   * @param {number} spatialTransformId
   * @param {number} submissionSpatialComponentId
   * @return {*}  {Promise<{ spatial_transform_submission_id: number }>}
   * @memberof SpatialService
   */
  async insertSpatialTransformSubmissionRecord(
    spatialTransformId: number,
    submissionSpatialComponentId: number
  ): Promise<{ spatial_transform_submission_id: number }> {
    return this.spatialRepository.insertSpatialTransformSubmissionRecord(
      spatialTransformId,
      submissionSpatialComponentId
    );
  }

  /**
   * Insert record of transform id used for submission security component record
   *
   * @param {number} securityTransformId
   * @param {number} submissionSpatialComponentId
   * @return {*}  {Promise<{ spatial_transform_submission_id: number }>}
   * @memberof SpatialService
   */
  async insertSecurityTransformSubmissionRecord(
    securityTransformId: number,
    submissionSpatialComponentId: number
  ): Promise<{ security_transform_submission_id: number }> {
    return this.spatialRepository.insertSecurityTransformSubmissionRecord(
      securityTransformId,
      submissionSpatialComponentId
    );
  }

  /**
   * Query builder to find spatial component by given criteria.
   *
   * Note: Returns an empty array of results if no matches are found.
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialSearchResponseRow[]>}
   * @memberof SpatialService
   */
  async findSpatialComponentsByCriteria(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialSearchResponseRow[]> {
    const userService = new UserService(this.connection);

    if (await userService.isSystemUserAdmin()) {
      return this.spatialRepository.findSpatialComponentsByCriteriaAsAdminUser(criteria);
    }

    return this.spatialRepository.findSpatialComponentsByCriteria(criteria);
  }

  /**
   * Delete spatial component records by submission id.
   *
   * @param {number} submission_id
   * @return {*}  {Promise<{ submission_id: number }[]>}
   * @memberof SpatialService
   */
  async deleteSpatialComponentsBySubmissionId(submission_id: number): Promise<{ submission_id: number }[]> {
    return this.spatialRepository.deleteSpatialComponentsBySubmissionId(submission_id);
  }

  /**
   * Delete records referencing which spatial transforms were applied to a spatial component
   *
   * @param {number} submission_id
   * @return {*}  {Promise<{ submission_id: number }[]>}
   * @memberof SpatialService
   */
  async deleteSpatialComponentsSpatialTransformRefsBySubmissionId(
    submission_id: number
  ): Promise<{ submission_id: number }[]> {
    return this.spatialRepository.deleteSpatialComponentsSpatialTransformRefsBySubmissionId(submission_id);
  }

  /**
   * Delete records referencing which security transforms were applied to a spatial component
   *
   * @param {number} submission_id
   * @return {*}  {Promise<{ submission_id: number }[]>}
   * @memberof SpatialService
   */
  async deleteSpatialComponentsSecurityTransformRefsBySubmissionId(
    submission_id: number
  ): Promise<{ submission_id: number }[]> {
    return this.spatialRepository.deleteSpatialComponentsSecurityTransformRefsBySubmissionId(submission_id);
  }

  /**
   * Query builder to find spatial component by given criteria
   *
   * @param {number[]} submissionSpatialComponentIds
   * @return {*}  {Promise<GeoJsonProperties[]>}
   * @memberof SpatialService
   */
  async findSpatialMetadataBySubmissionSpatialComponentIds(
    submissionSpatialComponentIds: number[]
  ): Promise<GeoJsonProperties[]> {
    const userService = new UserService(this.connection);

    const response = (await userService.isSystemUserAdmin())
      ? this.spatialRepository.findSpatialMetadataBySubmissionSpatialComponentIdsAsAdmin(submissionSpatialComponentIds)
      : this.spatialRepository.findSpatialMetadataBySubmissionSpatialComponentIds(submissionSpatialComponentIds);

    return (await response).map((row) => row.spatial_component_properties);
  }

  /**
   * Get the `Boundary` or `Boundary Centroid` spatial component for a specified dataset and return as WKT projected
   * using the provided SRID.
   *
   * Note: Does not check roles or permissions. Should only be used for internal functionality.
   *
   * Note: Can be used as part of a CQL Filter when making WFS requests (see GeoService).
   *
   * @param {number} submissionId A submission id
   * @param {(SPATIAL_COMPONENT_TYPE.BOUNDARY | SPATIAL_COMPONENT_TYPE.BOUNDARY_CENTROID)} spatialComponentType
   * @param {Srid} srid The id of the projection used when converting the geography to WKT
   * @return {*}  {Promise<FeatureCollection[]>}
   * @throws {Error} if no matches are found.
   * @memberof SpatialService
   */
  async getGeometryAsWktFromBoundarySpatialComponentBySubmissionId(
    submissionId: number,
    spatialComponentType: SPATIAL_COMPONENT_TYPE.BOUNDARY | SPATIAL_COMPONENT_TYPE.BOUNDARY_CENTROID,
    srid: Srid
  ) {
    return this.spatialRepository.getGeometryAsWktFromBoundarySpatialComponentBySubmissionId(
      submissionId,
      spatialComponentType,
      srid
    );
  }
}
