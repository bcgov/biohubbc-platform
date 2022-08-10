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
   * Collect transforms from db, run transformations on submission id, save result to spatial component table
   *
   * @param {number} submissionId
   * @return {*}  {Promise<void>}
   * @memberof SpatialService
   */
  async runSpatialTransforms(submissionId: number): Promise<void> {
    const spatialTransformRecords = await this.getSpatialTransformRecords();

    const promises1 = spatialTransformRecords.map(async (transformRecord) => {
      const transformed = await this.spatialRepository.runSpatialTransformOnSubmissionId(
        submissionId,
        transformRecord.transform
      );

      const promises2 = transformed.map(async (dataPoint) => {
        const submissionSpatialComponentId = await this.spatialRepository.insertSubmissionSpatialComponent(
          submissionId,
          dataPoint.result_data
        );

        await this.insertSpatialTransformSubmissionRecord(
          transformRecord.spatial_transform_id,
          submissionSpatialComponentId.submission_spatial_component_id
        );
      });

      await Promise.all(promises2);
    });

    await Promise.all(promises1);
  }

  /**
   *Collect security transforms from db, run transformations on submission id, update the spatial component table
   *
   * @param {number} submissionId
   * @return {*}  {Promise<void>}
   * @memberof SpatialService
   */
  async runSecurityTransforms(submissionId: number): Promise<void> {
    const spatialTransformRecords = await this.getSecurityTransformRecords();

    const promises1 = spatialTransformRecords.map(async (transformRecord) => {
      const transformed = await this.spatialRepository.runSecurityTransformOnSubmissionId(
        submissionId,
        transformRecord.transform
      );

      const promises2 = transformed.map(async (dataPoint) => {
        const submissionSpatialComponentId = await this.spatialRepository.updateSubmissionSpatialComponentWithSecurity(
          dataPoint.spatial_component.submission_spatial_component_id,
          dataPoint.spatial_component.spatial_data
        );

        await this.insertSecurityTransformSubmissionRecord(
          transformRecord.security_transform_id,
          submissionSpatialComponentId.submission_spatial_component_id
        );
      });

      await Promise.all(promises2);
    });

    await Promise.all(promises1);
  }

  /**
   * Query builder to find spatial component by given criteria
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialSearchResponseRow[]>}
   * @memberof SpatialService
   */
  async findSpatialComponentsByCriteria(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialSearchResponseRow[]> {
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

  async deleteSpatialComponentsSpatialTransformRefsBySubmissionId(
    submission_id: number
  ): Promise<{ submission_id: number }[]> {
    return this.spatialRepository.deleteSpatialComponentsSpatialTransformRefsBySubmissionId(submission_id);
  }

  async deleteSpatialComponentsSecurityTransformRefsBySubmissionId(
    submission_id: number
  ): Promise<{ submission_id: number }[]> {
    return this.spatialRepository.deleteSpatialComponentsSecurityTransformRefsBySubmissionId(submission_id);
  }

  /**
   * Query builder to find spatial component by given criteria
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialComponent[]>}
   * @memberof SpatialService
   */
  async findSpatialMetadataBySubmissionSpatialComponentId(
    submissionSpatialComponentId: number
  ): Promise<Record<string, string>> {
    const response = await this.spatialRepository.findSpatialMetadataBySubmissionSpatialComponentId(
      submissionSpatialComponentId
    );

    return (response.spatial_component?.features[0]?.properties as Record<string, string>) || {};
  }
}
