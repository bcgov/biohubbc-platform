import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ContributorCodeset, CreateContributorCodeset } from '../models/contributor-codeset';
import { ContributorCodesetCode, CreateContributorCodesetCode } from '../models/contributor-codeset-code';
import { CreateSubmissionFeaturePropertyBoolean } from '../models/submission-feature-property-boolean';
import { CreateSubmissionFeaturePropertyCode } from '../models/submission-feature-property-code';
import { CreateSubmissionFeaturePropertyGeometry } from '../models/submission-feature-property-geometry';
import { FeatureTypePropertyMetadata } from '../models/submission-feature-property-index';
import { CreateSubmissionFeaturePropertyNumber } from '../models/submission-feature-property-number';
import { CreateSubmissionFeaturePropertyString } from '../models/submission-feature-property-string';
import { CreateSubmissionFeaturePropertyTaxon } from '../models/submission-feature-property-taxon';
import { CreateSubmissionFeaturePropertyTimestamp } from '../models/submission-feature-property-timestamp';
import { SubmissionFeaturePropertyIndexRepository } from '../repositories/submission-feature-property-index-repository';
import { CodeReference } from '../utils/code-reference';
import { ContributorCodesetCodeService } from './contributor-codeset-code-service';
import { ContributorCodesetService } from './contributor-codeset-service';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyIndexService extends DBService {
  submissionFeaturePropertyIndexRepository: SubmissionFeaturePropertyIndexRepository;

  /**
   * Creates an instance of SubmissionFeaturePropertyIndexService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyIndexService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyIndexRepository = new SubmissionFeaturePropertyIndexRepository(connection);
  }

  /**
   * Delete all canonical property records for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async deletePropertyRecordsBySubmissionId(submissionId: number): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.deletePropertyRecordsBySubmissionId(submissionId);
  }

  /**
   * Get active feature type property metadata for feature type ids.
   *
   * @param {number[]} featureTypeIds
   * @return {Promise<FeatureTypePropertyMetadata[]>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async getFeatureTypePropertyMetadata(featureTypeIds: number[]): Promise<FeatureTypePropertyMetadata[]> {
    return this.submissionFeaturePropertyIndexRepository.getFeatureTypePropertyMetadata(featureTypeIds);
  }

  /**
   * Insert canonical string property records.
   *
   * @param {CreateSubmissionFeaturePropertyString[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertStringRecords(records: CreateSubmissionFeaturePropertyString[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertStringRecords(records);
  }

  /**
   * Insert canonical number property records.
   *
   * @param {CreateSubmissionFeaturePropertyNumber[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertNumberRecords(records: CreateSubmissionFeaturePropertyNumber[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertNumberRecords(records);
  }

  /**
   * Insert canonical boolean property records.
   *
   * @param {CreateSubmissionFeaturePropertyBoolean[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertBooleanRecords(records: CreateSubmissionFeaturePropertyBoolean[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertBooleanRecords(records);
  }

  /**
   * Insert canonical timestamp property records.
   *
   * @param {CreateSubmissionFeaturePropertyTimestamp[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertTimestampRecords(records: CreateSubmissionFeaturePropertyTimestamp[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertTimestampRecords(records);
  }

  /**
   * Insert canonical code property records.
   *
   * @param {CreateSubmissionFeaturePropertyCode[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertCodeRecords(records: CreateSubmissionFeaturePropertyCode[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertCodeRecords(records);
  }

  /**
   * Insert canonical taxon property records.
   *
   * @param {CreateSubmissionFeaturePropertyTaxon[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertTaxonRecords(records: CreateSubmissionFeaturePropertyTaxon[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertTaxonRecords(records);
  }

  /**
   * Insert canonical geometry property records.
   *
   * @param {CreateSubmissionFeaturePropertyGeometry[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async insertGeometryRecords(records: CreateSubmissionFeaturePropertyGeometry[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertGeometryRecords(records);
  }

  /**
   * Persist referenced contributor codesets and codes for a contributor.
   *
   * @param {number} contributorId
   * @param {Record<string, unknown>} codesets
   * @param {CodeReference[]} [codeReferences=[]]
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  async persistContributorCodesByContributorId(
    contributorId: number,
    codesets: Record<string, unknown>,
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

    const contributorCodesetService = new ContributorCodesetService(this.connection);
    const existingCodesets = await contributorCodesetService.createCodesets(contributorCodesetDefinitions);
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

    const contributorCodesetCodeService = new ContributorCodesetCodeService(this.connection);
    await contributorCodesetCodeService.createContributorCodesetCodes(contributorCodesetCodeDefinitions);
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
    const uniqueContributorCodesetKeys = [
      ...new Set(uniqueCodeReferences.map((reference) => reference.contributorCodesetKey))
    ];
    const rows =
      await this.submissionFeaturePropertyIndexRepository.getContributorCodeResolutionsByContributorIdAndCodesetKeys(
        contributorId,
        uniqueContributorCodesetKeys
      );

    const slugToContributorCodesetCodeId = new Map<string, number>();

    for (const row of rows) {
      const slug = `code::${row.contributor_codeset_key}::${row.contributor_codeset_code_key}`;
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

      slugToContributorCodesetCodeId.set(slug, row.contributor_codeset_code_id);
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
   * Normalize a referenced codeset and all its referenced codes.
   *
   * @private
   * @param {string} contributorCodesetKey
   * @param {unknown} rawContributorCodeset
   * @param {Set<string>} referencedCodesetCodeKeys
   * @return {Omit<ContributorCodeset, 'contributor_codeset_id' | 'contributor_id'> & { codesByKey: Map<string, Omit<ContributorCodesetCode, 'contributor_codeset_code_id' | 'contributor_codeset_id'>> }}
   * @memberof SubmissionFeaturePropertyIndexService
   */
  private normalizeCodeset(
    contributorCodesetKey: string,
    rawContributorCodeset: unknown,
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
