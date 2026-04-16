import { IDBConnection } from '../../database/db';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { getLogger } from '../../utils/logger';
import { ContributorService } from '../contributor-service';
import { DBService } from '../db-service';
import { SubmissionFeaturePropertyValidationOutcome } from './submission-feature-property-ingestion-service.interface';

const defaultLog = getLogger('services/ingestion/submission-feature-property-ingestion-service');

export class SubmissionFeaturePropertyIngestionService extends DBService {
  submissionFeaturePropertyIngestionRepository: SubmissionFeaturePropertyIngestionRepository;
  submissionRepository: SubmissionRepository;
  featureIngestionRepository: FeatureIngestionRepository;
  contributorService: ContributorService;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionFeaturePropertyIngestionRepository = new SubmissionFeaturePropertyIngestionRepository(connection);
    this.submissionRepository = new SubmissionRepository(connection);
    this.featureIngestionRepository = new FeatureIngestionRepository(connection);
    this.contributorService = new ContributorService(connection);
  }

  /**
   * Run the upload-scoped, phase-based ingestion pipeline.
   *
   * Generic property ingestion, datetime normalization, and spatial normalization are all executed
   * as set-based SQL phases. The service remains orchestration-only.
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
      const contributor = await this.contributorService.getContributorBySubmissionId(submissionId);
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'resolved contributor',
        submissionId,
        submissionUploadId,
        contributorId: contributor.contributor_id
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
      currentPhase = 'initialize working tables';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.initializeSessionTempTables(submissionUploadId);

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
      currentPhase = 'prepare upload property working set';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.prepareUploadPropertyWorkingSetBySubmissionUploadId(submissionUploadId);
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
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordPrimitiveValidationErrorsBySubmissionUploadId(
        submissionUploadId
      );

      // Phase 5: materialize complex candidates/resolution maps once for reuse.
      currentPhase = 'prepare complex property candidates';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.prepareComplexPropertyCandidatesBySubmissionUploadId(submissionUploadId, contributor.contributor_id);

      // Phase 6: FK reference validation/resolution diagnostics.
      currentPhase = 'record code, taxon, and artifact resolution errors';
      defaultLog.debug({
        label: 'indexSubmissionPropertiesBySubmissionUploadId',
        message: 'phase start',
        submissionId,
        submissionUploadId,
        phase: currentPhase
      });
      await this.submissionFeaturePropertyIngestionRepository.recordCodePropertyResolutionErrorsBySubmissionUploadId(
        submissionUploadId,
        contributor.contributor_id
      );
      await this.submissionFeaturePropertyIngestionRepository.recordTaxonPropertyResolutionErrorsBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.recordArtifactPropertyResolutionErrorsBySubmissionUploadId(
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
        const errorSamples =
          await this.submissionFeaturePropertyIngestionRepository.getIngestionErrorSamplesBySubmissionUploadId(
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
          errorSamples
        });

        return {
          status: 'invalid',
          errorCount,
          errorCounts,
          errorSamples
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
        submissionUploadId,
        contributor.contributor_id
      );
      await this.submissionFeaturePropertyIngestionRepository.insertTaxonPropertiesBySubmissionUploadId(
        submissionUploadId
      );
      await this.submissionFeaturePropertyIngestionRepository.insertArtifactLinksBySubmissionUploadId(
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
   */
  private async initializeSessionTempTables(submissionUploadId: string): Promise<void> {
    await this.submissionFeaturePropertyIngestionRepository.dropSubmissionFeaturePropertyStagingTempTable(
      submissionUploadId
    );
  }

  /**
   * Build upload-scoped metadata resolution and logical value working tables.
   *
   * This phase materializes the reusable relational state used by requiredness checks, primitive
   * validation, and downstream typed inserts.
   */
  private async prepareUploadPropertyWorkingSetBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.dropTmpUploadPropertyValuesTable(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.dropTmpResolvedStagedPropertiesTable(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.dropTmpUploadFeatureTypePropertyMapTable(submissionUploadId)
    ]);

    await this.submissionFeaturePropertyIngestionRepository.createTmpUploadFeatureTypePropertyMapBySubmissionUploadId(
      submissionUploadId
    );

    await this.submissionFeaturePropertyIngestionRepository.createTmpResolvedStagedPropertiesBySubmissionUploadId(
      submissionUploadId
    );

    await this.submissionFeaturePropertyIngestionRepository.createTmpUploadPropertyValuesTable(submissionUploadId);
  }

  /**
   * Materialize upload-scoped complex candidate/resolution tables once for reuse.
   *
   * Candidate tables are shared by both error-recording and final insert phases to avoid repeated
   * parsing/normalization work for datetime, spatial, code, taxon, and artifact values.
   */
  private async prepareComplexPropertyCandidatesBySubmissionUploadId(
    submissionUploadId: string,
    contributorId: number
  ): Promise<void> {
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.dropTmpValidPropertyValuesTable(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.dropTmpDatetimeCandidatesTable(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.dropTmpSpatialCandidatesTable(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.dropTmpCodeCandidatesTable(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.dropTmpTaxonCandidatesTable(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.dropTmpArtifactCandidatesTable(submissionUploadId)
    ]);

    await this.submissionFeaturePropertyIngestionRepository.createTmpValidPropertyValuesBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.createTmpDatetimeCandidatesTable(submissionUploadId);
    await this.submissionFeaturePropertyIngestionRepository.createTmpSpatialCandidatesTable(submissionUploadId);
    await this.submissionFeaturePropertyIngestionRepository.createTmpCodeCandidatesBySubmissionUploadId(
      submissionUploadId,
      contributorId
    );
    await this.submissionFeaturePropertyIngestionRepository.createTmpTaxonCandidatesTable(submissionUploadId);
    await this.submissionFeaturePropertyIngestionRepository.createTmpArtifactCandidatesBySubmissionUploadId(
      submissionUploadId
    );
  }
}
