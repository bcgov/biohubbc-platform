import { IDBConnection } from '../database/db';
import {
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
   * Collect transform from db, run transform on submission id, save result on spatial component table
   *
   * @param {number} submissionId
   * @param {number} spatialTransformId
   * @return {*}  {Promise<{ submission_spatial_component_id: number }>}
   * @memberof SpatialService
   */
  async runTransform(
    submissionId: number,
    spatialTransformId: number
  ): Promise<{ submission_spatial_component_id: number }> {
    const spatialTransform = await this.getSpatialTransformBySpatialTransformId(spatialTransformId);

    const transformed = await this.spatialRepository.runSpatialTransformOnSubmissionId(
      submissionId,
      spatialTransform.transform
    );

    const submissionSpatialComponentId = await this.spatialRepository.insertSubmissionSpatialComponent(
      submissionId,
      transformed
    );

    await this.insertSpatialTransformSubmissionRecord(
      spatialTransformId,
      submissionSpatialComponentId.submission_spatial_component_id
    );

    return submissionSpatialComponentId;
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
