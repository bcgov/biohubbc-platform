import { IDBConnection } from '../../database/db';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { getLogger } from '../../utils/logger';
import { ContributorService } from '../contributor-service';
import { DBService } from '../db-service';
import { SubmissionUploadReviewService } from '../upload/submission-upload-review-service';
import { SubmissionUploadService } from '../upload/submission-upload-service';
import { SubmissionFeaturePropertyValidationOutcome } from './submission-feature-property-ingestion-service.interface';

const defaultLog = getLogger('services/ingestion/submission-feature-property-ingestion-service');

export class SubmissionFeaturePropertyIngestionService extends DBService {
  submissionFeaturePropertyIngestionRepository: SubmissionFeaturePropertyIngestionRepository;
  submissionRepository: SubmissionRepository;
  featureIngestionRepository: FeatureIngestionRepository;
  contributorService: ContributorService;
  submissionUploadReviewService: SubmissionUploadReviewService;
  submissionUploadService: SubmissionUploadService;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionFeaturePropertyIngestionRepository = new SubmissionFeaturePropertyIngestionRepository(connection);
    this.submissionRepository = new SubmissionRepository(connection);
    this.featureIngestionRepository = new FeatureIngestionRepository(connection);
    this.contributorService = new ContributorService(connection);
    this.submissionUploadReviewService = new SubmissionUploadReviewService(connection);
    this.submissionUploadService = new SubmissionUploadService(connection);
  }

  /**
   * Run the upload-scoped, phase-based ingestion pipeline.
   *
   * Generic property ingestion, datetime normalization, and spatial normalization are all executed
   * as set-based SQL phases. The service remains orchestration-only.
   *
   * @param {number} submissionId Submission scope for the features being indexed.
   * @param {string} submissionUploadId Upload scope for the staged feature rows.
   * @returns {Promise<SubmissionFeaturePropertyValidationOutcome>} Indexing outcome with validation diagnostics when invalid.
   */
  async indexSubmissionPropertiesBySubmissionUploadId(
    submissionId: number,
    submissionUploadId: string
  ): Promise<SubmissionFeaturePropertyValidationOutcome> {
    let currentPhase = 'start';

    defaultLog.debug({
      label: 'indexSubmissionPropertiesBySubmissionUploadId',
      message: 'start',
      submissionId,
      submissionUploadId
    });

    try {
      currentPhase = 'resolve contributor';
      const contributor = await this.contributorService.getContributorBySubmissionUploadId(submissionUploadId);
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'resolved contributor',
        submissionId,
        submissionUploadId,
        contributorId: contributor.contributor_id
      });

      // Resolve the Blueprint pinned to this upload. Property resolution and requiredness checks use
      // this Blueprint rather than re-selecting the current default (the upload is grandfathered in).
      currentPhase = 'resolve upload blueprint';
      const { blueprint_id: blueprintId } = await this.submissionUploadService.getSubmissionUpload(submissionUploadId);
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'resolved blueprint',
        submissionId,
        submissionUploadId,
        blueprintId
      });
      // Cleanup for idempotency.
      currentPhase = 'cleanup existing property records and relationships';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await Promise.all([
        this.submissionFeaturePropertyIngestionRepository.deletePropertyRecordsBySubmissionUploadId(submissionUploadId),
        this.submissionRepository.deleteSubmissionFeatureRelationshipsBySubmissionUploadId(submissionUploadId)
      ]);

      // Phase 1: initialize upload-scoped working rows.
      currentPhase = 'initialize raw property staging';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.initializePropertyIngestionStagingBySubmissionUploadId(submissionUploadId);

      // Phase 2: flatten raw `data.properties` into staging rows.
      currentPhase = 'stage expanded properties';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.submissionFeaturePropertyIngestionRepository.stageExpandedPropertiesBySubmissionUploadId(
        submissionUploadId
      );

      // Phase 3: prepare upload-local metadata and logical value working tables.
      currentPhase = 'populate upload property working set';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.populateUploadPropertyWorkingSetBySubmissionUploadId(submissionUploadId, blueprintId);
      await this.submissionFeaturePropertyIngestionRepository.deleteIngestionErrorsBySubmissionUploadId(
        submissionUploadId
      );

      // Phase 4: requiredness and primitive/cardinality validation.
      currentPhase = 'record required and primitive validation errors';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.submissionFeaturePropertyIngestionRepository.recordMissingRequiredPropertyErrorsBySubmissionUploadId(
        submissionUploadId,
        blueprintId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordPrimitiveValidationErrorsBySubmissionUploadId(
        submissionUploadId
      );

      // Phase 5: materialize complex candidates/resolution maps once for reuse.
      currentPhase = 'populate complex property candidates';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.populateComplexPropertyCandidateStagingBySubmissionUploadId(
        submissionUploadId,
        contributor.contributor_id
      );

      // Phase 6: FK reference validation/resolution diagnostics.
      currentPhase = 'record code, taxon, artifact, and feature resolution errors';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.submissionFeaturePropertyIngestionRepository.recordCodePropertyResolutionErrorsBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordTaxonPropertyResolutionErrorsBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordArtifactPropertyResolutionErrorsBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordFeaturePropertyResolutionErrorsBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordCircularFeatureReferenceErrorsBySubmissionUploadId(
        submissionUploadId
      );

      // Phase 7: parent/reference diagnostics.
      currentPhase = 'record parent and reference errors';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.submissionFeaturePropertyIngestionRepository.recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordUnresolvedParentErrorsBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordReferenceErrorsBySubmissionUploadId(
        submissionUploadId
      );

      // Phase 8: SQL-native datetime/spatial normalization diagnostics.
      currentPhase = 'record datetime and spatial normalization errors';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.submissionFeaturePropertyIngestionRepository.recordDatetimeNormalizationErrorsBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordSpatialNormalizationErrorsBySubmissionUploadId(
        submissionUploadId
      );

      // Phase 9: fail-fast boundary before canonical writes.
      //
      // Phases 4-8 accumulate a full deep-validation snapshot directly in
      // `submission_feature_error`. If any errors exist, we must:
      // 1. read aggregate diagnostics for logs/debugging
      // 2. stop before canonical writes
      //
      // Important:
      // - this is expected invalid-data flow (not a system exception)
      // - durable persistence already happened during validation phases
      // - canonical parent/property/relationship writes must not run when invalid
      currentPhase = 'validation fail-fast boundary';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      const errorCount =
        await this.submissionFeaturePropertyIngestionRepository.getIngestionErrorCountBySubmissionUploadId(
          submissionUploadId
        );

      if (errorCount > 0) {
        const errorCounts = await this.submissionFeaturePropertyIngestionRepository.getIngestionErrorCountsByCode(
          submissionUploadId
        );
        const errorSummaries =
          await this.submissionFeaturePropertyIngestionRepository.getIngestionErrorSummariesBySubmissionUploadId(
            submissionUploadId,
            20
          );
        defaultLog.error({
          label: 'indexSubmissionPropertiesBySubmissionUploadId',
          message: 'Submission feature property ingestion failed with validation errors',
          submissionId,
          submissionUploadId,
          phase: currentPhase,
          errorCount,
          errorCounts,
          errorSummaries
        });

        return {
          status: 'invalid',
          errorCount,
          errorCounts,
          errorSummaries
        };
      }

      // Phase 10: canonical parent updates and property inserts.
      currentPhase = 'insert canonical property records';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.featureIngestionRepository.updateSubmissionFeatureParentsBySubmissionUploadId(submissionUploadId);
      await Promise.all([
        this.submissionFeaturePropertyIngestionRepository.insertStringPropertiesBySubmissionUploadId(
          submissionUploadId
        ),
        this.submissionFeaturePropertyIngestionRepository.insertNumberPropertiesBySubmissionUploadId(
          submissionUploadId
        ),
        this.submissionFeaturePropertyIngestionRepository.insertBooleanPropertiesBySubmissionUploadId(
          submissionUploadId
        )
      ]);
      await this.submissionFeaturePropertyIngestionRepository.insertTimestampPropertiesBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.insertGeometryPropertiesBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.insertCodePropertiesBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.insertFeaturePropertiesBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.insertTaxonPropertiesBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.insertArtifactPropertiesBySubmissionUploadId(
        submissionUploadId
      );

      // Phase 11: relationships from `data.content`.
      currentPhase = 'insert feature relationships';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.submissionFeaturePropertyIngestionRepository.insertFeatureRelationshipsBySubmissionUploadId(
        submissionUploadId
      );

      await this.submissionUploadReviewService.requestDefaultReviewsForUpload(
        submissionId,
        submissionUploadId,
        this.connection.systemUserId()
      );

      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'complete',
        submissionId,
        submissionUploadId
      });

      return { status: 'ok' };
    } catch (error) {
      defaultLog.error({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'unexpected failure',
        submissionId,
        submissionUploadId,
        phase: currentPhase,
        error
      });

      throw error;
    }
  }

  /**
   * Initialize upload-scoped staging and diagnostics working rows.
   *
   * @param {string} submissionUploadId Upload scope.
   * @returns {Promise<void>}
   */
  private async initializePropertyIngestionStagingBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    await this.submissionFeaturePropertyIngestionRepository.clearRawPropertyStagingBySubmissionUploadId(
      submissionUploadId
    );
  }

  /**
   * Build upload-scoped metadata resolution and logical value working tables.
   *
   * This phase materializes the reusable relational state used by requiredness checks, primitive
   * validation, and downstream typed inserts.
   *
   * @param {string} submissionUploadId Upload scope.
   * @param {number} blueprintId The Blueprint pinned to the upload.
   * @returns {Promise<void>}
   */
  private async populateUploadPropertyWorkingSetBySubmissionUploadId(
    submissionUploadId: string,
    blueprintId: number
  ): Promise<void> {
    await this.submissionFeaturePropertyIngestionRepository.clearUploadPropertyWorkingSetStagingBySubmissionUploadId(
      submissionUploadId
    );

    await this.submissionFeaturePropertyIngestionRepository.populateResolvedPropertyStagingBySubmissionUploadId(
      submissionUploadId,
      blueprintId
    );

    await this.submissionFeaturePropertyIngestionRepository.populateTypedPropertyValueStagingBySubmissionUploadId(
      submissionUploadId
    );
  }

  /**
   * Materialize upload-scoped complex candidate/resolution tables once for reuse.
   *
   * Candidate tables are shared by both error-recording and final insert phases to avoid repeated
   * parsing/normalization work for datetime, spatial, code, taxon, and artifact values.
   *
   * @param {string} submissionUploadId Upload scope.
   * @param {number} contributorId Contributor scope for contributor-owned code resolution.
   * @returns {Promise<void>}
   */
  private async populateComplexPropertyCandidateStagingBySubmissionUploadId(
    submissionUploadId: string,
    contributorId: number
  ): Promise<void> {
    await this.submissionFeaturePropertyIngestionRepository.clearComplexPropertyCandidateStagingBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.populateDatetimeCandidateStagingBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.populateSpatialCandidateStagingBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.populateCodeCandidateStagingBySubmissionUploadId(
      submissionUploadId,
      contributorId
    );
    await this.submissionFeaturePropertyIngestionRepository.populateTaxonCandidateStagingBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.populateArtifactCandidateStagingBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.populateFeatureCandidateStagingBySubmissionUploadId(
      submissionUploadId
    );
  }
}
