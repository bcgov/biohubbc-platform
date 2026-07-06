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
  ingestionRepository: FeatureIngestionRepository;
  defaultLog = getLogger('services/ingestion/submission-feature-ingestion-service');
  private knownFeatureTypeMapPromise: Promise<Map<string, number>> | null = null;

  /**
   * Creates an instance of SubmissionFeatureIngestionService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeatureIngestionService
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
   * @param {Map<string, number>} knownFeatureTypeMap
   * @returns {Promise<void>}
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
        contentHash: computeSubmissionFeatureContentHash(feature)
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

    const insertedCount = await this.ingestionRepository.insertSubmissionFeatureRecordsByTypeId(records);
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
   * @returns {Promise<Map<string, number>>}
   * @memberof SubmissionFeatureIngestionService
   */
  async getKnownFeatureTypeMap(): Promise<Map<string, number>> {
    this.knownFeatureTypeMapPromise ??= this.ingestionRepository
      .getKnownFeatureTypeMap()
      .then((rows) => new Map(rows.map((row) => [row.name, row.feature_type_id])));

    return this.knownFeatureTypeMapPromise;
  }

  /**
   * Soft-delete features for one upload attempt.
   *
   * @param {string} submissionUploadId
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureIngestionService
   */
  async deleteFeaturesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    await this.ingestionRepository.deleteSubmissionFeaturesBySubmissionUploadId(submissionUploadId);
  }
}
