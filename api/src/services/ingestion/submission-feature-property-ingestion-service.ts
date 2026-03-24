import { IDBConnection } from '../../database/db';
import { IngestionValidationError } from '../../errors/submission-errors';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { getLogger } from '../../utils/logger';
import { ContributorService } from '../contributor-service';
import { DBService } from '../db-service';

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
  async indexSubmissionPropertiesBySubmissionUploadId(submissionId: number, submissionUploadId: string): Promise<void> {
    defaultLog.debug({
      label: 'indexSubmissionPropertiesBySubmissionUploadId',
      message: 'start',
      submissionId,
      submissionUploadId
    });

    const contributor = await this.contributorService.getContributorBySubmissionId(submissionId);
    // This flow must execute on a single open DB session for temp tables to remain visible
    // across all repository phases.

    // Cleanup for idempotency.
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.deletePropertyRecordsBySubmissionUploadId(submissionUploadId),
      this.submissionRepository.deleteSubmissionFeatureRelationshipsBySubmissionUploadId(submissionUploadId)
    ]);

    // Phase 1: initialize session-scoped temp staging/error tables.
    await this.initializeSessionTempTables();

    // Phase 2: flatten raw `data.properties` into staging rows.
    await this.submissionFeaturePropertyIngestionRepository.stageExpandedPropertiesBySubmissionUploadId(
      submissionUploadId
    );

    // Phase 3: prepare upload-local temp metadata and logical value working tables.
    await this.prepareUploadPropertyWorkingSetBySubmissionUploadId(submissionUploadId);
    await this.submissionFeaturePropertyIngestionRepository.deleteIngestionErrorsBySubmissionUploadId(
      submissionUploadId
    );

    // Phase 4: requiredness and primitive/cardinality validation.
    await this.submissionFeaturePropertyIngestionRepository.recordMissingRequiredPropertyErrorsBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.recordPrimitiveValidationErrorsBySubmissionUploadId(
      submissionUploadId
    );

    // Phase 5: materialize complex candidates/resolution maps once for reuse.
    await this.prepareComplexPropertyCandidatesBySubmissionUploadId(submissionUploadId, contributor.contributor_id);

    // Phase 6: FK reference validation/resolution diagnostics.
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

    // Phase 7: parent validation and update.
    await this.submissionFeaturePropertyIngestionRepository.recordUnresolvedParentErrorsBySubmissionUploadId(
      submissionUploadId
    );
    await this.featureIngestionRepository.updateSubmissionFeatureParentsBySubmissionUploadId(submissionUploadId);

    // Phase 8: SQL-native datetime/spatial normalization diagnostics.
    await this.submissionFeaturePropertyIngestionRepository.recordDatetimeNormalizationErrorsBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.recordSpatialNormalizationErrorsBySubmissionUploadId(
      submissionUploadId
    );

    // Phase 9: canonical inserts for primitive, datetime, spatial and FK-backed properties.
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.insertStringPropertiesBySubmissionUploadId(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.insertNumberPropertiesBySubmissionUploadId(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.insertBooleanPropertiesBySubmissionUploadId(submissionUploadId)
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
    await this.submissionFeaturePropertyIngestionRepository.insertArtifactLinksBySubmissionUploadId(submissionUploadId);

    // Phase 10: relationships from `data.content`.
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.insertFeatureRelationshipsBySubmissionUploadId(
        submissionUploadId
      ),
      this.submissionFeaturePropertyIngestionRepository.recordReferenceErrorsBySubmissionUploadId(submissionUploadId)
    ]);

    // Phase 11: fail-at-end with aggregated diagnostics after full-upload processing.
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
        errorCount,
        errorCounts,
        errorSamples
      });

      throw new IngestionValidationError('Submission feature property ingestion failed with validation errors');
    }
  }

  /**
   * Initialize session-scoped temp staging and diagnostics tables.
   *
   * This orchestration remains in the service layer so repository methods can stay one-statement-per-call.
   */
  private async initializeSessionTempTables(): Promise<void> {
    await this.submissionFeaturePropertyIngestionRepository.dropSubmissionFeaturePropertyStagingTempTable();
    await this.submissionFeaturePropertyIngestionRepository.createSubmissionFeaturePropertyStagingTempTable();
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.createSubmissionFeaturePropertyStagingTempUploadFeatureIndex(),
      this.submissionFeaturePropertyIngestionRepository.createSubmissionFeaturePropertyStagingTempUploadPropertyIndex()
    ]);

    await this.submissionFeaturePropertyIngestionRepository.createIngestionErrorTempTable();
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.createIngestionErrorTempUploadIndex(),
      this.submissionFeaturePropertyIngestionRepository.createIngestionErrorTempErrorCodeIndex(),
      this.submissionFeaturePropertyIngestionRepository.createIngestionErrorTempFeatureIndex()
    ]);
  }

  /**
   * Build upload-scoped metadata resolution and logical value temp working tables.
   *
   * This phase materializes the reusable relational state used by requiredness checks, primitive
   * validation, and downstream typed inserts.
   */
  private async prepareUploadPropertyWorkingSetBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.dropTmpUploadPropertyValuesTable(),
      this.submissionFeaturePropertyIngestionRepository.dropTmpResolvedStagedPropertiesTable(),
      this.submissionFeaturePropertyIngestionRepository.dropTmpResolvedFeatureTypePropertyKeysTable(),
      this.submissionFeaturePropertyIngestionRepository.dropTmpUploadFeatureTypePropertyKeysTable(),
      this.submissionFeaturePropertyIngestionRepository.dropTmpUploadFeatureTypePropertyMapTable()
    ]);

    await this.submissionFeaturePropertyIngestionRepository.createTmpUploadFeatureTypePropertyMapBySubmissionUploadId(
      submissionUploadId
    );
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.createTmpUploadFeatureTypePropertyMapFeatureTypePropertyNameIndex(),
      this.submissionFeaturePropertyIngestionRepository.createTmpUploadFeatureTypePropertyMapFeatureTypePropertyIdIndex()
    ]);

    await this.submissionFeaturePropertyIngestionRepository.createTmpUploadFeatureTypePropertyKeysBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.createTmpUploadFeatureTypePropertyKeysIndex();

    await this.submissionFeaturePropertyIngestionRepository.createTmpResolvedFeatureTypePropertyKeysTable();
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.createTmpResolvedFeatureTypePropertyKeysFeatureTypePropertyNameIndex(),
      this.submissionFeaturePropertyIngestionRepository.createTmpResolvedFeatureTypePropertyKeysFeatureTypePropertyIdIndex()
    ]);

    await this.submissionFeaturePropertyIngestionRepository.createTmpResolvedStagedPropertiesBySubmissionUploadId(
      submissionUploadId
    );
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.createTmpResolvedStagedPropertiesSubmissionFeatureIndex(),
      this.submissionFeaturePropertyIngestionRepository.createTmpResolvedStagedPropertiesFeatureTypePropertyIndex(),
      this.submissionFeaturePropertyIngestionRepository.createTmpResolvedStagedPropertiesPropertyTypeIndex()
    ]);

    await this.submissionFeaturePropertyIngestionRepository.createTmpUploadPropertyValuesTable();
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.createTmpUploadPropertyValuesPropertyTypeIndex(),
      this.submissionFeaturePropertyIngestionRepository.createTmpUploadPropertyValuesFeatureTypePropertyIndex(),
      this.submissionFeaturePropertyIngestionRepository.createTmpUploadPropertyValuesSubmissionFeatureIndex()
    ]);
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
      this.submissionFeaturePropertyIngestionRepository.dropTmpValidPropertyValuesTable(),
      this.submissionFeaturePropertyIngestionRepository.dropTmpDatetimeCandidatesTable(),
      this.submissionFeaturePropertyIngestionRepository.dropTmpSpatialCandidatesTable(),
      this.submissionFeaturePropertyIngestionRepository.dropTmpCodeCandidatesTable(),
      this.submissionFeaturePropertyIngestionRepository.dropTmpTaxonCandidatesTable(),
      this.submissionFeaturePropertyIngestionRepository.dropTmpArtifactCandidatesTable()
    ]);

    await this.submissionFeaturePropertyIngestionRepository.createTmpValidPropertyValuesBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.createTmpDatetimeCandidatesTable();
    await this.submissionFeaturePropertyIngestionRepository.createTmpSpatialCandidatesTable();
    await this.submissionFeaturePropertyIngestionRepository.createTmpCodeCandidatesByContributorId(contributorId);
    await this.submissionFeaturePropertyIngestionRepository.createTmpTaxonCandidatesTable();
    await this.submissionFeaturePropertyIngestionRepository.createTmpArtifactCandidatesBySubmissionUploadId(
      submissionUploadId
    );
  }
}
