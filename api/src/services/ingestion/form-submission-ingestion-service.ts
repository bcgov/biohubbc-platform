import { INGESTION_FEATURE_BATCH_SIZE } from '../../constants/ingestion';
import { IngestionValidationError } from '../../errors/submission-errors';
import { IFlattenedBlock } from '../../models/submission-feature';
import { SubmissionUpload } from '../../models/submission-upload';
import { withConnection } from '../../queue/with-connection';
import { getLogger } from '../../utils/logger';
import { SubmissionFeatureIngestionService } from './submission-feature-ingestion-service';
import { IValidationResult } from './submission-ingestion-service.interface';

const defaultLog = getLogger('services/ingestion/form-submission-ingestion-service');

/**
 * Service for ingesting the features of a form submission upload.
 *
 * A form submit stores its features with the upload instead of building a tarball, so there is nothing to stream or
 * parse: the features are persisted through the same shallow feature ingestion as tarball features. Reconciliation,
 * indexing, review and approval then run unchanged.
 *
 * @export
 * @class FormSubmissionIngestionService
 */
export class FormSubmissionIngestionService {
  /**
   * Ingest a form submission upload's features.
   *
   * Idempotent: safe for pg-boss retries. Never-activated features from a partial attempt are removed before the
   * features are inserted again.
   *
   * @param {SubmissionUpload} submissionUpload - The pre-resolved upload record.
   * @param {IFlattenedBlock[]} features - The features the form submit stored with the upload.
   * @returns {Promise<IValidationResult>} Validation result.
   * @throws {IngestionValidationError} If the upload has no features.
   * @memberof FormSubmissionIngestionService
   */
  async ingestFormSubmissionUpload(
    submissionUpload: SubmissionUpload,
    features: IFlattenedBlock[]
  ): Promise<IValidationResult> {
    const { submission_upload_id: submissionUploadId, submission_id: submissionId } = submissionUpload;

    if (!features.length) {
      throw new IngestionValidationError('The form submission has no features');
    }

    await withConnection(async (connection) => {
      const submissionFeatureIngestionService = new SubmissionFeatureIngestionService(connection);
      await submissionFeatureIngestionService.deleteSubmissionFeaturesBySubmissionUploadId(submissionUploadId);
    });

    const knownFeatureTypeMap = await withConnection(async (connection) => {
      const submissionFeatureIngestionService = new SubmissionFeatureIngestionService(connection);
      return submissionFeatureIngestionService.getKnownFeatureTypeMap();
    });

    const featureBatches: IFlattenedBlock[][] = [];

    for (let start = 0; start < features.length; start += INGESTION_FEATURE_BATCH_SIZE) {
      featureBatches.push(features.slice(start, start + INGESTION_FEATURE_BATCH_SIZE));
    }

    // A form submission is bounded by its rows, so its batches are few and can be persisted concurrently.
    await Promise.all(
      featureBatches.map((featureBatch) =>
        withConnection(async (connection) => {
          const submissionFeatureIngestionService = new SubmissionFeatureIngestionService(connection);
          await submissionFeatureIngestionService.ingestFeatureBatch(
            submissionId,
            submissionUploadId,
            featureBatch,
            knownFeatureTypeMap
          );
        })
      )
    );

    const featureBatchCount = featureBatches.length;

    defaultLog.info({
      label: 'ingestFormSubmissionUpload',
      message: 'Form submission upload ingestion completed successfully',
      submissionUploadId,
      submissionId,
      featureCount: features.length,
      featureBatchCount
    });

    return {
      valid: true,
      errors: [],
      metadata: {
        errorCount: 0,
        recordCount: 0,
        featureCount: features.length,
        featureBatchCount,
        featureRowsPersisted: features.length
      }
    };
  }
}
