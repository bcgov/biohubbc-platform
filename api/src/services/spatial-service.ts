import { IDBConnection } from '../database/db';
import {
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

  async deleteSpatialComponentsBySubmissionId(submission_id: number): Promise<{ submission_id: number }[]> {
    return this.spatialRepository.deleteSpatialComponentsBySubmissionId(submission_id);
  }

  async deleteSpatialComponentsTransformRefsBySubmissionId(
    submission_id: number
  ): Promise<{ submission_id: number }[]> {
    return this.spatialRepository.deleteSpatialComponentsTransformRefsBySubmissionId(submission_id);
  }

  /**
   * Query builder to find spatial component by given criteria
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialComponent[]>}
   * @memberof SpatialService
   */
  async findSpatialMetadataBySubmissionId(submissionSpatialComponentId: number): Promise<Record<string, string>> {
    const response = await this.spatialRepository.findSpatialMetadataBySubmissionId(submissionSpatialComponentId);

    return (response.spatial_component?.features[0]?.properties as Record<string, string>) || {};
  }
}
