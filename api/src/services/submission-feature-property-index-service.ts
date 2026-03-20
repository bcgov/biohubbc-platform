import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ContributorCodeset, CreateContributorCodeset } from '../models/contributor-codeset';
import { ContributorCodesetCode, CreateContributorCodesetCode } from '../models/contributor-codeset-code';
import { CreateSubmissionFeatureArtifact } from '../models/submission-feature-artifact';
import { CreateSubmissionFeaturePropertyBoolean } from '../models/submission-feature-property-boolean';
import { CreateSubmissionFeaturePropertyCode } from '../models/submission-feature-property-code';
import { CreateSubmissionFeaturePropertyGeometry } from '../models/submission-feature-property-geometry';
import { FeatureTypePropertyMetadata } from '../models/submission-feature-property-index';
import { CreateSubmissionFeaturePropertyNumber } from '../models/submission-feature-property-number';
import { CreateSubmissionFeaturePropertyString } from '../models/submission-feature-property-string';
import { CreateSubmissionFeaturePropertyTaxon } from '../models/submission-feature-property-taxon';
import { CreateSubmissionFeaturePropertyTimestamp } from '../models/submission-feature-property-timestamp';
import { CodeReference } from '../utils/code-reference';
import { CodeService } from './code-service';
import { ContributorCodesetCodeService } from './contributor-codeset-code-service';
import { ContributorCodesetService } from './contributor-codeset-service';
import { DBService } from './db-service';
import { SubmissionFeatureArtifactService } from './submission-feature-artifact-service';
import { SubmissionFeaturePropertyBooleanService } from './submission-feature-property-boolean-service';
import { SubmissionFeaturePropertyCodeService } from './submission-feature-property-code-service';
import { SubmissionFeaturePropertyGeometryService } from './submission-feature-property-geometry-service';
import { SubmissionFeaturePropertyNumberService } from './submission-feature-property-number-service';
import { SubmissionFeaturePropertyStringService } from './submission-feature-property-string-service';
import { SubmissionFeaturePropertyTaxonService } from './submission-feature-property-taxon-service';
import { SubmissionFeaturePropertyTimestampService } from './submission-feature-property-timestamp-service';
import { UploadArtifactService } from './upload/upload-artifact-service';
import type { TarCodeset, TarCodesets } from './ingestion/submission-ingestion-codes-service.interface';

export class SubmissionFeaturePropertyIndexService extends DBService {
  submissionFeaturePropertyStringService: SubmissionFeaturePropertyStringService;
  submissionFeaturePropertyNumberService: SubmissionFeaturePropertyNumberService;
  submissionFeaturePropertyBooleanService: SubmissionFeaturePropertyBooleanService;
  submissionFeaturePropertyTimestampService: SubmissionFeaturePropertyTimestampService;
  submissionFeatureArtifactService: SubmissionFeatureArtifactService;
  submissionFeaturePropertyCodeService: SubmissionFeaturePropertyCodeService;
  submissionFeaturePropertyTaxonService: SubmissionFeaturePropertyTaxonService;
  submissionFeaturePropertyGeometryService: SubmissionFeaturePropertyGeometryService;
  contributorCodesetService: ContributorCodesetService;
  contributorCodesetCodeService: ContributorCodesetCodeService;
  uploadArtifactService: UploadArtifactService;
  codeService: CodeService;

  /**
   * Creates an instance of SubmissionFeaturePropertyIndexService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyIndexService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyStringService = new SubmissionFeaturePropertyStringService(connection);
    this.submissionFeaturePropertyNumberService = new SubmissionFeaturePropertyNumberService(connection);
    this.submissionFeaturePropertyBooleanService = new SubmissionFeaturePropertyBooleanService(connection);
    this.submissionFeaturePropertyTimestampService = new SubmissionFeaturePropertyTimestampService(connection);
    this.submissionFeatureArtifactService = new SubmissionFeatureArtifactService(connection);
    this.submissionFeaturePropertyCodeService = new SubmissionFeaturePropertyCodeService(connection);
    this.submissionFeaturePropertyTaxonService = new SubmissionFeaturePropertyTaxonService(connection);
    this.submissionFeaturePropertyGeometryService = new SubmissionFeaturePropertyGeometryService(connection);
    this.contributorCodesetService = new ContributorCodesetService(connection);
    this.contributorCodesetCodeService = new ContributorCodesetCodeService(connection);
    this.uploadArtifactService = new UploadArtifactService(connection);
    this.codeService = new CodeService(connection);
  }

  /**
   * Delete all canonical property records for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async deletePropertyRecordsBySubmissionId(submissionId: number): Promise<void> {
    await Promise.all([
      this.submissionFeaturePropertyStringService.deleteSubmissionFeaturePropertyStringsBySubmissionId(submissionId),
      this.submissionFeaturePropertyNumberService.deleteSubmissionFeaturePropertyNumbersBySubmissionId(submissionId),
      this.submissionFeaturePropertyBooleanService.deleteSubmissionFeaturePropertyBooleansBySubmissionId(submissionId),
      this.submissionFeaturePropertyTimestampService.deleteSubmissionFeaturePropertyTimestampsBySubmissionId(submissionId),
      this.submissionFeatureArtifactService.deleteSubmissionFeatureArtifactsBySubmissionId(submissionId),
      this.submissionFeaturePropertyCodeService.deleteSubmissionFeaturePropertyCodesBySubmissionId(submissionId),
      this.submissionFeaturePropertyTaxonService.deleteSubmissionFeaturePropertyTaxonsBySubmissionId(submissionId),
      this.submissionFeaturePropertyGeometryService.deleteSubmissionFeaturePropertyGeometriesBySubmissionId(submissionId)
    ]);
  }

  /**
   * Delete all canonical property records for one upload attempt.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async deletePropertyRecordsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    await Promise.all([
      this.submissionFeaturePropertyStringService.deleteSubmissionFeaturePropertyStringsBySubmissionUploadId(
        submissionUploadId
      ),
      this.submissionFeaturePropertyNumberService.deleteSubmissionFeaturePropertyNumbersBySubmissionUploadId(
        submissionUploadId
      ),
      this.submissionFeaturePropertyBooleanService.deleteSubmissionFeaturePropertyBooleansBySubmissionUploadId(
        submissionUploadId
      ),
      this.submissionFeaturePropertyTimestampService.deleteSubmissionFeaturePropertyTimestampsBySubmissionUploadId(
        submissionUploadId
      ),
      this.submissionFeatureArtifactService.deleteSubmissionFeatureArtifactsBySubmissionUploadId(
        submissionUploadId
      ),
      this.submissionFeaturePropertyCodeService.deleteSubmissionFeaturePropertyCodesBySubmissionUploadId(
        submissionUploadId
      ),
      this.submissionFeaturePropertyTaxonService.deleteSubmissionFeaturePropertyTaxonsBySubmissionUploadId(
        submissionUploadId
      ),
      this.submissionFeaturePropertyGeometryService.deleteSubmissionFeaturePropertyGeometriesBySubmissionUploadId(
        submissionUploadId
      )
    ]);
  }

  /**
   * Get active feature type property metadata for feature type ids.
   *
   * @param {number[]} featureTypeIds
   * @return {Promise<FeatureTypePropertyMetadata[]>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async getFeatureTypePropertyMetadata(featureTypeIds: number[]): Promise<FeatureTypePropertyMetadata[]> {
    return this.codeService.getFeatureTypePropertyMetadataByFeatureTypeIds(featureTypeIds);
  }

  /**
   * Insert canonical string property records.
   *
   * @param {CreateSubmissionFeaturePropertyString[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertStringRecords(records: CreateSubmissionFeaturePropertyString[]): Promise<void> {
    await this.submissionFeaturePropertyStringService.createSubmissionFeaturePropertyStrings(records);
  }

  /**
   * Insert canonical number property records.
   *
   * @param {CreateSubmissionFeaturePropertyNumber[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertNumberRecords(records: CreateSubmissionFeaturePropertyNumber[]): Promise<void> {
    await this.submissionFeaturePropertyNumberService.createSubmissionFeaturePropertyNumbers(records);
  }

  /**
   * Insert canonical boolean property records.
   *
   * @param {CreateSubmissionFeaturePropertyBoolean[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertBooleanRecords(records: CreateSubmissionFeaturePropertyBoolean[]): Promise<void> {
    await this.submissionFeaturePropertyBooleanService.createSubmissionFeaturePropertyBooleans(records);
  }

  /**
   * Insert canonical timestamp property records.
   *
   * @param {CreateSubmissionFeaturePropertyTimestamp[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertTimestampRecords(records: CreateSubmissionFeaturePropertyTimestamp[]): Promise<void> {
    await this.submissionFeaturePropertyTimestampService.createSubmissionFeaturePropertyTimestamps(records);
  }

  /**
   * Insert canonical artifact property records.
   *
   * @param {CreateSubmissionFeatureArtifact[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertArtifactRecords(records: CreateSubmissionFeatureArtifact[]): Promise<void> {
    await this.submissionFeatureArtifactService.createSubmissionFeatureArtifacts(records);
  }

  /**
   * Insert canonical code property records.
   *
   * @param {CreateSubmissionFeaturePropertyCode[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertCodeRecords(records: CreateSubmissionFeaturePropertyCode[]): Promise<void> {
    await this.submissionFeaturePropertyCodeService.createSubmissionFeaturePropertyCodes(records);
  }

  /**
   * Insert canonical taxon property records.
   *
   * @param {CreateSubmissionFeaturePropertyTaxon[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertTaxonRecords(records: CreateSubmissionFeaturePropertyTaxon[]): Promise<void> {
    await this.submissionFeaturePropertyTaxonService.createSubmissionFeaturePropertyTaxons(records);
  }

  /**
   * Insert canonical geometry property records.
   *
   * @param {CreateSubmissionFeaturePropertyGeometry[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertGeometryRecords(records: CreateSubmissionFeaturePropertyGeometry[]): Promise<void> {
    await this.submissionFeaturePropertyGeometryService.createSubmissionFeaturePropertyGeometries(records);
  }

  /**
   * Persist referenced contributor codesets and codes for a contributor.
   *
   * @param {number} contributorId
   * @param {TarCodesets} codesets
   * @param {CodeReference[]} [codeReferences=[]]
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async persistContributorCodesByContributorId(
    contributorId: number,
    codesets: TarCodesets,
    codeReferences: CodeReference[] = []
  ): Promise<void> {
    if (!Object.keys(codesets).length || !codeReferences.length) {
      return;
    }

    const referencedCodeKeys = this.toReferencedCodeKeys(codeReferences);
    const normalizedCodesets = [...referencedCodeKeys.entries()].map(([contributorCodesetKey, referencedCodeKeys]) =>
      this.normalizeCodeset(contributorCodesetKey, codesets[contributorCodesetKey], referencedCodeKeys)
    );
    const contributorCodesetDefinitions: CreateContributorCodeset[] = normalizedCodesets.map((normalizedCodeset) => ({
      contributor_id: contributorId,
      key: normalizedCodeset.key,
      external_id: normalizedCodeset.external_id,
      label: normalizedCodeset.label,
      description: normalizedCodeset.description
    }));

    const existingCodesets = await this.contributorCodesetService.createCodesets(contributorCodesetDefinitions);
    const contributorCodesetsByKey = new Map<string, ContributorCodeset>();

    for (const contributorCodeset of existingCodesets) {
      const existing = contributorCodesetsByKey.get(contributorCodeset.key);
      if (existing) {
        throw new ApiExecuteSQLError('Ambiguous contributor codeset key resolution', [
          'SubmissionFeaturePropertyIndexService->persistContributorCodesByContributorId',
          {
            contributorCodesetKey: contributorCodeset.key,
            advice: 'Use a unique contributor codeset key per contributor.'
          }
        ]);
      }

      contributorCodesetsByKey.set(contributorCodeset.key, contributorCodeset);
    }

    const contributorCodesetCodeDefinitions: CreateContributorCodesetCode[] = [];
    for (const normalizedCodeset of normalizedCodesets) {
      const contributorCodeset = contributorCodesetsByKey.get(normalizedCodeset.key);

      if (!contributorCodeset) {
        throw new ApiExecuteSQLError('Failed to resolve contributor codeset row after upsert', [
          'SubmissionFeaturePropertyIndexService->persistContributorCodesByContributorId',
          {
            contributorCodesetKey: normalizedCodeset.key,
            contributorCodesetExternalId: normalizedCodeset.external_id
          }
        ]);
      }

      for (const normalizedCode of normalizedCodeset.codesByKey.values()) {
        contributorCodesetCodeDefinitions.push({
          contributor_codeset_id: contributorCodeset.contributor_codeset_id,
          key: normalizedCode.key,
          external_id: normalizedCode.external_id,
          label: normalizedCode.label,
          description: normalizedCode.description
        });
      }
    }

    await this.contributorCodesetCodeService.createContributorCodesetCodes(contributorCodesetCodeDefinitions);
  }

  /**
   * Resolve code slug references to contributor_codeset_code_id values.
   *
   * @param {number} contributorId
   * @param {CodeReference[]} codeReferences
   * @return {Promise<Map<string, number>>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async resolveContributorCodesetCodeIdsByCodeReferences(
    contributorId: number,
    codeReferences: CodeReference[]
  ): Promise<Map<string, number>> {
    if (!codeReferences.length) {
      return new Map<string, number>();
    }

    const uniqueCodeReferences = [...new Map(codeReferences.map((reference) => [reference.slug, reference])).values()];
    const uniqueContributorCodesetKeys = [...new Set(uniqueCodeReferences.map((reference) => reference.contributorCodesetKey))];
    const contributorCodesets = await this.contributorCodesetService.getContributorCodesetsByContributorIdAndKeys(
      contributorId,
      uniqueContributorCodesetKeys
    );
    const contributorCodesetIdToKey = new Map(
      contributorCodesets.map((contributorCodeset) => [contributorCodeset.contributor_codeset_id, contributorCodeset.key])
    );
    const contributorCodesetCodes = await this.contributorCodesetCodeService.getContributorCodesetCodesByContributorCodesetIds(
      [...contributorCodesetIdToKey.keys()]
    );

    const slugToContributorCodesetCodeId = new Map<string, number>();

    for (const contributorCodesetCode of contributorCodesetCodes) {
      const contributorCodesetKey = contributorCodesetIdToKey.get(contributorCodesetCode.contributor_codeset_id);
      if (!contributorCodesetKey) {
        continue;
      }

      const slug = `code::${contributorCodesetKey}::${contributorCodesetCode.key}`;
      if (slugToContributorCodesetCodeId.has(slug)) {
        throw new ApiExecuteSQLError(
          'Ambiguous code slug resolution across multiple rows. Each contributor codeset key and codeset code key must be unique.',
          [
            'SubmissionFeaturePropertyIndexService->resolveContributorCodesetCodeIdsByCodeReferences',
            {
              contributorId,
              slug,
              advice: 'Use a new key when creating a new external_id.'
            }
          ]
        );
      }

      slugToContributorCodesetCodeId.set(slug, contributorCodesetCode.contributor_codeset_code_id);
    }

    for (const reference of uniqueCodeReferences) {
      if (!slugToContributorCodesetCodeId.has(reference.slug)) {
        throw new ApiExecuteSQLError(
          'Failed to resolve code slug to contributor_codeset_code_id. Ensure code definitions are ingested for this contributor.',
          [
            'SubmissionFeaturePropertyIndexService->resolveContributorCodesetCodeIdsByCodeReferences',
            {
              contributorId,
              slug: reference.slug,
              advice:
                'Ingest contributor_codeset and contributor_codeset_code definitions first. If metadata changed, provide a new key.'
            }
          ]
        );
      }
    }

    return slugToContributorCodesetCodeId;
  }

  /**
   * Resolve artifact references to artifact_id values for one upload attempt.
   *
   * @param {string} submissionUploadId
   * @param {string[]} references
   * @return {Promise<Map<string, string>>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async resolveArtifactIdsByReferences(submissionUploadId: string, references: string[]): Promise<Map<string, string>> {
    if (!references.length) {
      return new Map<string, string>();
    }

    const rows = await this.uploadArtifactService.getFeatureArtifactResolutionsBySubmissionUploadIdAndReferences(
      submissionUploadId,
      references
    );
    const referenceToArtifactId = new Map<string, string>();

    for (const row of rows) {
      const existing = referenceToArtifactId.get(row.artifact_reference);
      if (existing && existing !== row.artifact_id) {
        throw new ApiExecuteSQLError('Ambiguous artifact reference resolution', [
          'SubmissionFeaturePropertyIndexService->resolveArtifactIdsByReferences',
          {
            submissionUploadId,
            artifactReference: row.artifact_reference
          }
        ]);
      }

      referenceToArtifactId.set(row.artifact_reference, row.artifact_id);
    }

    return referenceToArtifactId;
  }

  /**
   * Normalize a referenced codeset and all its referenced codes.
   *
   * @private
   * @param {string} contributorCodesetKey
   * @param {(TarCodeset | undefined)} rawContributorCodeset
   * @param {Set<string>} referencedCodesetCodeKeys
   * @return {Omit<ContributorCodeset, 'contributor_codeset_id' | 'contributor_id'> & { codesByKey: Map<string, Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>> }}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  private normalizeCodeset(
    contributorCodesetKey: string,
    rawContributorCodeset: TarCodeset | undefined,
    referencedCodesetCodeKeys: Set<string>
  ): Omit<ContributorCodeset, 'contributor_codeset_id' | 'contributor_id'> & {
    codesByKey: Map<string, Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>>;
  } {
    return this.normalizeKeyValues(
      contributorCodesetKey,
      rawContributorCodeset,
      `codesets.${contributorCodesetKey}`,
      referencedCodesetCodeKeys
    ) as Omit<ContributorCodeset, 'contributor_codeset_id' | 'contributor_id'> & {
      codesByKey: Map<string, Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>>;
    };
  }

  /**
   * Normalize contributor key/value metadata and nested child codes recursively.
   *
   * @private
   * @param {string} key
   * @param {unknown} rawValue
   * @param {string} path
   * @param {Set<string>} [referencedChildKeys]
   * @return {(Omit<ContributorCodeset, 'contributor_codeset_id' | 'contributor_id'> & { codesByKey: Map<string, Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>> }) | Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  private normalizeKeyValues(
    key: string,
    rawValue: unknown,
    path: string,
    referencedChildKeys?: Set<string>
  ):
    | (Omit<ContributorCodeset, 'contributor_codeset_id' | 'contributor_id'> & {
        codesByKey: Map<string, Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>>;
      })
    | Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'> {
    if (typeof rawValue !== 'object' || rawValue === null) {
      throw new ApiExecuteSQLError('Invalid contributor payload', [
        'SubmissionFeaturePropertyIndexService->normalizeKeyValues',
        { path, key }
      ]);
    }

    const value = rawValue as Record<string, unknown>;
    const externalId =
      typeof value.external_id === 'string' && value.external_id.trim() ? value.external_id.trim() : null;
    const description =
      typeof value.description === 'string' && value.description.trim() ? value.description.trim().toLowerCase() : null;

    if (typeof value.label !== 'string' || !value.label.trim()) {
      throw new ApiExecuteSQLError('Contributor label is required', [
        'SubmissionFeaturePropertyIndexService->normalizeKeyValues',
        {
          path: `${path}.label`,
          advice: 'Provide a non-empty label for referenced contributor codesets/codes.'
        }
      ]);
    }

    const normalized = {
      key,
      external_id: externalId,
      label: value.label.trim().toLowerCase(),
      description
    };

    if (!referencedChildKeys) {
      return normalized as Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>;
    }

    const codes =
      typeof value.codes === 'object' && value.codes !== null ? (value.codes as Record<string, unknown>) : {};
    const codesByKey = new Map<
      string,
      Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>
    >();

    for (const childKey of referencedChildKeys) {
      const rawChildValue = codes[childKey];

      if (typeof rawChildValue !== 'object' || rawChildValue === null) {
        throw new ApiExecuteSQLError('Invalid contributor code payload', [
          'SubmissionFeaturePropertyIndexService->normalizeKeyValues',
          {
            path: `${path}.codes.${childKey}`,
            key: childKey
          }
        ]);
      }

      codesByKey.set(
        childKey,
        this.normalizeKeyValues(childKey, rawChildValue, `${path}.codes.${childKey}`) as Omit<
          ContributorCodesetCode,
          'contributor_codeset_code_id' | 'contributor_codeset_id'
        >
      );
    }

    return {
      ...normalized,
      codesByKey
    } as Omit<ContributorCodeset, 'contributor_codeset_id' | 'contributor_id'> & {
      codesByKey: Map<string, Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>>;
    };
  }

  /**
   * Group code references by contributor codeset key and referenced code keys.
   *
   * @private
   * @param {CodeReference[]} codeReferences
   * @return {Map<string, Set<string>>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  private toReferencedCodeKeys(codeReferences: CodeReference[]): Map<string, Set<string>> {
    const referenced = new Map<string, Set<string>>();

    for (const codeReference of codeReferences) {
      const existing = referenced.get(codeReference.contributorCodesetKey) ?? new Set<string>();
      existing.add(codeReference.contributorCodesetCodeKey);
      referenced.set(codeReference.contributorCodesetKey, existing);
    }

    return referenced;
  }
}
