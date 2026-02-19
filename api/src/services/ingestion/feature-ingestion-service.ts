import { IDBConnection } from '../../database/db';
import { IFlattenedBlock } from '../../models/submission-feature';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { DBService } from '../db-service';
import { FeatureValidationService } from './feature-validation-service';
import { IValidationResult } from './feature-validation-service.interface';

/**
 * Service for ingesting validated submission features into the database.
 *
 * Composes FeatureValidationService for validation and SubmissionRepository for insertion.
 * Thin orchestrator: validate, then insert via three-pass approach (insert → parent refs → content relationships).
 *
 * @export
 * @class FeatureIngestionService
 * @extends {DBService}
 */
export class FeatureIngestionService extends DBService {
  featureValidationService: FeatureValidationService;

  constructor(connection: IDBConnection) {
    super(connection);

    this.featureValidationService = new FeatureValidationService(connection);
  }

  /**
   * Ingest flat submission features: validate and insert.
   *
   * Idempotent: soft-deletes existing features before inserting, safe for job retries.
   *
   * @param {number} submissionId - The submission to add features to
   * @param {IFlattenedBlock[]} features - Flat array of features with UUID references
   * @returns {Promise<IValidationResult>} Validation result with valid flag and any errors
   * @memberof FeatureIngestionService
   */
  async ingestFeatures(submissionId: number, features: IFlattenedBlock[]): Promise<IValidationResult> {
    // 1. Validate all features
    const validationResult = await this.featureValidationService.validateFlatSubmissionFeatures(features);

    if (!validationResult.valid) {
      return validationResult;
    }

    // 2. Delete existing features and relationships (idempotency for job retries)
    const submissionRepository = new SubmissionRepository(this.connection);
    await submissionRepository.deleteSubmissionFeatures(submissionId);
    await submissionRepository.deleteSubmissionFeatureRelationships(submissionId);

    // 3. Insert features (two-pass for parent references, Pass 3 for content relationships)
    await this.insertFlatFeatures(submissionId, features);

    return { valid: true, errors: [] };
  }

  /**
   * Insert flat features using three-pass approach.
   * Pass 1: Insert all features with parent = NULL
   * Pass 2: Update parent references using UUID → ID mapping
   * Pass 3: Insert content relationships (parent-child from content array)
   *
   * @private
   * @param {number} submissionId - The submission ID
   * @param {IFlattenedBlock[]} features - Features to insert
   * @memberof FeatureIngestionService
   */
  private async insertFlatFeatures(submissionId: number, features: IFlattenedBlock[]): Promise<void> {
    const submissionRepository = new SubmissionRepository(this.connection);
    const uuidToDbId = new Map<string, number>();

    // Pass 1: Insert all features without parent references
    for (const feature of features) {
      const result = await submissionRepository.insertSubmissionFeatureRecord(
        submissionId,
        null, // parent set in pass 2
        feature.id,
        feature.type,
        feature.properties
      );
      uuidToDbId.set(feature.id, result.submission_feature_id);
    }

    // Pass 2: Update parent references
    for (const feature of features) {
      if (feature.parent) {
        const parentDbId = uuidToDbId.get(feature.parent);
        const featureDbId = uuidToDbId.get(feature.id);
        if (parentDbId && featureDbId) {
          await submissionRepository.updateSubmissionFeatureParent(featureDbId, parentDbId);
        }
      }
    }

    // Pass 3: Insert content relationships (many-to-many)
    const relationshipPairs = this.buildContentRelationshipPairs(features, uuidToDbId);
    if (relationshipPairs.length > 0) {
      await submissionRepository.insertSubmissionFeatureRelationships(relationshipPairs);
    }
  }

  /**
   * Build source-target relationship pairs from features' content arrays.
   *
   * @private
   * @param {IFlattenedBlock[]} features - Features with content references
   * @param {Map<string, number>} uuidToDbId - UUID to submission_feature_id mapping
   * @return {Array<{ source_feature_id: number; target_feature_id: number }>}
   * @memberof FeatureIngestionService
   */
  private buildContentRelationshipPairs(
    features: IFlattenedBlock[],
    uuidToDbId: Map<string, number>
  ): Array<{ source_feature_id: number; target_feature_id: number }> {
    const pairs: Array<{
      source_feature_id: number;
      target_feature_id: number;
    }> = [];
    for (const feature of features) {
      if (!feature.content?.length) {
        continue;
      }
      const sourceDbId = uuidToDbId.get(feature.id);
      if (sourceDbId === undefined) {
        continue;
      }
      for (const targetId of feature.content) {
        const targetDbId = uuidToDbId.get(targetId);
        if (targetDbId !== undefined) {
          pairs.push({
            source_feature_id: sourceDbId,
            target_feature_id: targetDbId
          });
        }
      }
    }
    return pairs;
  }
}
