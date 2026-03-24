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
  private submissionFeaturePropertyIngestionRepository: SubmissionFeaturePropertyIngestionRepository;
  private submissionRepository: SubmissionRepository;
  private featureIngestionRepository: FeatureIngestionRepository;
  private contributorService: ContributorService;

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
      this.submissionRepository.deleteSubmissionFeatureRelationshipsBySubmissionUploadId(submissionUploadId),
      this.submissionFeaturePropertyIngestionRepository.deleteStagingRowsBySubmissionUploadId(submissionUploadId)
    ]);

    // Phase 1: flatten raw `data.properties` into staging rows.
    await this.submissionFeaturePropertyIngestionRepository.stageExpandedPropertiesBySubmissionUploadId(
      submissionUploadId
    );

    // Phase 2: prepare upload-local temp working tables and temp error diagnostics table.
    await this.prepareUploadWorkingTablesBySubmissionUploadId(submissionUploadId);
    await this.submissionFeaturePropertyIngestionRepository.deleteIngestionErrorsBySubmissionUploadId(
      submissionUploadId
    );

    // Phase 3: requiredness and primitive/cardinality validation.
    await this.submissionFeaturePropertyIngestionRepository.recordMissingRequiredPropertyErrorsBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.recordPrimitiveValidationErrorsBySubmissionUploadId(
      submissionUploadId
    );

    // Phase 4: FK reference validation/resolution diagnostics.
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

    // Phase 5: parent validation and update.
    await this.submissionFeaturePropertyIngestionRepository.recordUnresolvedParentErrorsBySubmissionUploadId(
      submissionUploadId
    );
    await this.featureIngestionRepository.updateSubmissionFeatureParentsBySubmissionUploadId(submissionUploadId);

    // Phase 6: SQL-native datetime/spatial normalization diagnostics.
    await this.submissionFeaturePropertyIngestionRepository.recordDatetimeNormalizationErrorsBySubmissionUploadId(
      submissionUploadId
    );
    await this.submissionFeaturePropertyIngestionRepository.recordSpatialNormalizationErrorsBySubmissionUploadId(
      submissionUploadId
    );

    // Phase 7: canonical inserts for primitive, datetime, spatial and FK-backed properties.
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

    // Phase 8: relationships from `data.content`.
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.insertFeatureRelationshipsBySubmissionUploadId(
        submissionUploadId
      ),
      this.submissionFeaturePropertyIngestionRepository.recordReferenceErrorsBySubmissionUploadId(submissionUploadId)
    ]);

    // Phase 9: fail-at-end with aggregated diagnostics after full-upload processing.
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
   * Build all session-scoped temp working tables used by SQL ingestion phases.
   *
   * Important: these temp objects are connection-scoped. This method is intentionally service-level so
   * we can keep one await/one SQL-call granularity in repository methods while preserving strict
   * serial execution order here.
   */
  private async prepareUploadWorkingTablesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    await this.submissionFeaturePropertyIngestionRepository.createIngestionErrorTempTable();
    await Promise.all([
      this.submissionFeaturePropertyIngestionRepository.createIngestionErrorTempUploadIndex(),
      this.submissionFeaturePropertyIngestionRepository.createIngestionErrorTempErrorCodeIndex(),
      this.submissionFeaturePropertyIngestionRepository.createIngestionErrorTempFeatureIndex()
    ]);

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
}
