import { IDBConnection } from '../../database/db';
import { IFlattenedBlock } from '../../models/submission-feature';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { computeSubmissionFeatureContentHash } from '../../utils/feature-content-hash';
import { getLogger } from '../../utils/logger';
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
  featureIngestionRepository: FeatureIngestionRepository;
  defaultLog = getLogger('services/ingestion/submission-feature-ingestion-service');
  private knownFeatureTypeMapPromise: Promise<Map<string, number>> | null = null;

  /**
   * Creates an instance of SubmissionFeatureIngestionService.
   *
   * @param {IDBConnection} connection Database connection used for feature ingestion operations.
   * @memberof SubmissionFeatureIngestionService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.featureIngestionRepository = new FeatureIngestionRepository(connection);
  }

  /**
   * Insert one shallow-validated feature batch.
   *
   * This method does not resolve parent/content references. Those are resolved later by
   * the indexing workflow from persisted raw payload.
   *
   * @param {number} submissionId Submission identifier assigned to every feature in the batch.
   * @param {string} submissionUploadId Submission upload identifier assigned to every feature in the batch.
   * @param {IFlattenedBlock[]} features Shallow-validated feature payloads to persist.
   * @param {Map<string, number>} knownFeatureTypeMap Known feature type names mapped to database identifiers.
   * @returns {Promise<void>} Resolves after all recognized feature rows have been inserted.
   * @memberof SubmissionFeatureIngestionService
   */
  async ingestFeatureBatch(
    submissionId: number,
    submissionUploadId: string,
    features: IFlattenedBlock[],
    knownFeatureTypeMap: Map<string, number>
  ): Promise<void> {
    if (!features.length) {
      return;
    }

    let droppedUnknownTypeCount = 0;

    const records = features.flatMap((feature) => {
      const featureTypeId = knownFeatureTypeMap.get(feature.type);
      if (!featureTypeId) {
        droppedUnknownTypeCount += 1;
        return [];
      }

      return {
        submissionId,
        submissionUploadId,
        sourceId: feature.id,
        featureTypeId,
        data: feature,
        dataByteSize: Buffer.byteLength(JSON.stringify(feature)),
        contentHash: computeSubmissionFeatureContentHash(feature),
        universalId: feature.universal_id
      };
    });

    if (droppedUnknownTypeCount > 0) {
      this.defaultLog.debug({
        label: 'ingestFeatureBatch',
        message: 'Skipped feature rows with unknown feature type',
        submissionId,
        submissionUploadId,
        droppedUnknownTypeCount
      });
    }

    if (!records.length) {
      return;
    }

    const insertedCount = await this.featureIngestionRepository.insertSubmissionFeatures(records);
    const expectedCount = records.length;

    if (insertedCount < expectedCount) {
      this.defaultLog.warn({
        label: 'ingestFeatureBatch',
        message: 'Some feature rows were not inserted during batch ingest',
        submissionId,
        submissionUploadId,
        expectedCount,
        insertedCount,
        droppedCount: expectedCount - insertedCount
      });
    }
  }

  /**
   * Resolve known active and retired feature type mappings once per service instance.
   *
   * @private
   * @returns {Promise<Map<string, number>>} Known feature type names mapped to their database identifiers.
   * @memberof SubmissionFeatureIngestionService
   */
  async getKnownFeatureTypeMap(): Promise<Map<string, number>> {
    this.knownFeatureTypeMapPromise ??= this.featureIngestionRepository
      .getKnownFeatureTypeMap()
      .then((rows) => new Map(rows.map((row) => [row.name, row.feature_type_id])));

    return this.knownFeatureTypeMapPromise;
  }

  /**
   * Delete pending rows from an incomplete ingestion attempt.
   *
   * @param {string} submissionUploadId Submission upload identifier whose pending features are removed.
   * @returns {Promise<void>} Resolves after pending feature rows for the upload have been deleted.
   * @memberof SubmissionFeatureIngestionService
   */
  async deleteSubmissionFeaturesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    await this.featureIngestionRepository.deleteSubmissionFeaturesBySubmissionUploadId(submissionUploadId);
  }

  /**
   * Resolve parent feature references for rows belonging to one upload.
   *
   * @param {string} submissionUploadId The submission_upload_id scope.
   * @param {number} submissionId The submission the upload belongs to.
   * @returns {Promise<void>} Resolves after parent references have been updated for the upload rows.
   * @memberof SubmissionFeatureIngestionService
   */
  async updateSubmissionFeatureParentsBySubmissionUploadId(
    submissionUploadId: string,
    submissionId: number
  ): Promise<void> {
    await this.featureIngestionRepository.updateSubmissionFeatureParentsBySubmissionUploadId(
      submissionUploadId,
      submissionId
    );
  }
}
