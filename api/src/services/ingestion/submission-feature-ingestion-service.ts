import { IDBConnection } from '../../database/db';
import { IFlattenedBlock } from '../../models/submission-feature';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { DBService } from '../db-service';

/**
 * Service for ingesting shallow-validated submission feature batches.
 * Deep validation and relationship resolution run later in indexing.
 *
 * @export
 * @class SubmissionFeatureIngestionService
 * @extends {DBService}
 */
export class SubmissionFeatureIngestionService extends DBService {
  ingestionRepository: FeatureIngestionRepository;

  /**
   * Creates an instance of SubmissionFeatureIngestionService.
   *
   * @param {IDBConnection} connection
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.ingestionRepository = new FeatureIngestionRepository(connection);
  }

  /**
   * Insert one shallow-validated feature batch.
   *
   * This method does not resolve parent/content references. Those are resolved later by
   * the indexing workflow from persisted raw payload.
   *
   * @param {number} submissionId
   * @param {string} submissionUploadId
   * @param {IFlattenedBlock[]} features
   * @returns {Promise<void>}
   */
  async ingestFeatureBatch(
    submissionId: number,
    submissionUploadId: string,
    features: IFlattenedBlock[]
  ): Promise<void> {
    if (!features.length) {
      return;
    }

    const records = features.map((feature) => {
      return {
        submissionId,
        submissionUploadId,
        sourceId: feature.id,
        featureTypeName: feature.type,
        data: feature,
        dataByteSize: Buffer.byteLength(JSON.stringify(feature))
      };
    });

    await this.ingestionRepository.insertSubmissionFeatureRecords(records);
  }

  /**
   * Soft-delete features for one upload attempt.
   *
   * @param {string} submissionUploadId
   * @returns {Promise<void>}
   */
  async deleteFeaturesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    await this.ingestionRepository.deleteSubmissionFeaturesBySubmissionUploadId(submissionUploadId);
  }
}
