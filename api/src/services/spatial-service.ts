import { IDBConnection } from '../database/db';
import {
  IGetSpatialTransformRecord,
  IInsertSpatialTransform,
  ISpatialComponentsSearchCriteria,
  ISubmissionSpatialComponent,
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
  async getSpatialTransformRecordByName(spatialTransformName: string): Promise<IGetSpatialTransformRecord> {
    return this.spatialRepository.getSpatialTransformRecordByName(spatialTransformName);
  }

  /**
   * get spatial transform string from id
   *
   * @param {number} spatialTransformId
   * @return {*}  {Promise<{ transform: string }>}
   * @memberof SpatialService
   */
  async getSpatialTransformBySpatialTransformId(spatialTransformId: number): Promise<{ transform: string }> {
    return this.spatialRepository.getSpatialTransformBySpatialTransformId(spatialTransformId);
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
   * Collect transform from db, run transform on submission id, save result to spatial component table
   *
   * @param {number} submissionId
   * @param {string} spatialTransformName
   * @return {*}  {Promise<void>}
   * @memberof SpatialService
   */
  async runSpatialTransform(submissionId: number, spatialTransformName: string): Promise<void> {
    const spatialTransformRecord = await this.getSpatialTransformRecordByName(spatialTransformName);

    const transformed = await this.spatialRepository.runSpatialTransformOnSubmissionId(
      submissionId,
      spatialTransformRecord.transform
    );

    transformed.forEach(async (dataPoint) => {
      const submissionSpatialComponentId = await this.spatialRepository.insertSubmissionSpatialComponent(
        submissionId,
        dataPoint.result_data
      );

      await this.insertSpatialTransformSubmissionRecord(
        spatialTransformRecord.spatial_transform_id,
        submissionSpatialComponentId.submission_spatial_component_id
      );
    });
  }

  /**
   * Query builder to find spatial component by given criteria
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialComponent[]>}
   * @memberof SpatialService
   */
  async findSpatialComponentsByCriteria(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialComponent[]> {
    return this.spatialRepository.findSpatialComponentsByCriteria(criteria);
  }
}
