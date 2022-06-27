import { IDBConnection } from '../database/db';
import { IInsertSpatialTransform, SpatialRepository } from '../repositories/spatial-repository';
import { DBService } from './db-service';

export class SpatialService extends DBService {
  spatialRepository: SpatialRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.spatialRepository = new SpatialRepository(connection);
  }

  async insertSpatialTransform(
    spatialTransformDetails: IInsertSpatialTransform
  ): Promise<{ spatial_transform_id: number }> {
    return this.spatialRepository.insertSpatialTransform(spatialTransformDetails);
  }

  async getSpatialTransformBySpatialTransformId(spatialTransformId: number): Promise<{ transform: string }> {
    return this.spatialRepository.getSpatialTransformBySpatialTransformId(spatialTransformId);
  }

  async insertSpatialTransformSubmissionRecord(
    spatialTransformId: number,
    submissionSpatialComponentId: number
  ): Promise<{ spatial_transform_submission_id: number }> {
    return this.spatialRepository.insertSpatialTransformSubmissionRecord(
      spatialTransformId,
      submissionSpatialComponentId
    );
  }

  async runTransform(submissionId: number, spatialTransformId: number): Promise<any> {
    const spatialTransform = await this.getSpatialTransformBySpatialTransformId(spatialTransformId);

    const transformed = await this.spatialRepository.runSpatialTransformOnSubmissionId(
      submissionId,
      spatialTransform.transform
    );

    const response = await this.spatialRepository.insertSubmissionSpatialComponent(submissionId, transformed.features);

    return response;
  }
}
