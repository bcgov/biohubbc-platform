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

type CreateContributorCodesetCodeDefinition = CreateContributorCodesetCode & {
  contributor_codeset_key: string;
};

export class SubmissionFeaturePropertyIndexService extends DBService {
  submissionFeaturePropertyIndexRepository: SubmissionFeaturePropertyIndexRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyIndexRepository = new SubmissionFeaturePropertyIndexRepository(connection);
  }

  async deletePropertyRecordsBySubmissionId(submissionId: number): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.deletePropertyRecordsBySubmissionId(submissionId);
  }

  async getFeatureTypePropertyMetadata(featureTypeIds: number[]): Promise<FeatureTypePropertyMetadata[]> {
    return this.submissionFeaturePropertyIndexRepository.getFeatureTypePropertyMetadata(featureTypeIds);
  }

  async insertStringRecords(records: CreateSubmissionFeaturePropertyString[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertStringRecords(records);
  }

  async insertNumberRecords(records: CreateSubmissionFeaturePropertyNumber[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertNumberRecords(records);
  }

  async insertBooleanRecords(records: CreateSubmissionFeaturePropertyBoolean[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertBooleanRecords(records);
  }

  async insertTimestampRecords(records: CreateSubmissionFeaturePropertyTimestamp[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertTimestampRecords(records);
  }

  async insertCodeRecords(records: CreateSubmissionFeaturePropertyCode[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertCodeRecords(records);
  }

  async insertTaxonRecords(records: CreateSubmissionFeaturePropertyTaxon[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertTaxonRecords(records);
  }

  async insertGeometryRecords(records: CreateSubmissionFeaturePropertyGeometry[]): Promise<void> {
    await this.submissionFeaturePropertyIndexRepository.insertGeometryRecords(records);
  }

  async persistContributorCodesByContributorId(
    contributorId: number,
    codesets: Record<string, unknown>,
    codeReferences: CodeReference[] = []
  ): Promise<Map<string, number>> {
    if (!Object.keys(codesets).length || !codeReferences.length) {
      return new Map<string, number>();
    }

    const referencedCodeKeys = this.toReferencedCodeKeys(codeReferences);
    const contributorCodesetDefinitions = this.toContributorCodesetDefinitions(
      contributorId,
      codesets,
      referencedCodeKeys
    );
    const contributorCodesetService = new ContributorCodesetService(this.connection);
    const existingCodesets = await contributorCodesetService.createCodesets(contributorCodesetDefinitions);
    const contributorCodesetCodeDefinitions = this.toContributorCodesetCodeDefinitions(
      codesets,
      existingCodesets,
      referencedCodeKeys
    );
    const contributorCodesetCodeService = new ContributorCodesetCodeService(this.connection);
    const resolvedCodes = await contributorCodesetCodeService.createContributorCodesetCodes(
      contributorCodesetCodeDefinitions.map((definition) => ({
        contributor_codeset_id: definition.contributor_codeset_id,
        key: definition.key,
        external_id: definition.external_id,
        label: definition.label,
        description: definition.description
      }))
    );

    return this.mapCodesToSlugMap(contributorCodesetCodeDefinitions, resolvedCodes);
  }

  async resolveContributorCodesetCodeIdsByCodeReferences(
    contributorId: number,
    codeReferences: CodeReference[]
  ): Promise<Map<string, number>> {
    if (!codeReferences.length) {
      return new Map<string, number>();
    }

    const uniqueContributorCodesetKeys = [
      ...new Set(codeReferences.map((reference) => reference.contributorCodesetKey))
    ];
    const rows =
      await this.submissionFeaturePropertyIndexRepository.getContributorCodeResolutionsByContributorIdAndCodesetKeys(
        contributorId,
        uniqueContributorCodesetKeys
      );

    const slugToRows = new Map<string, typeof rows>();

    for (const row of rows) {
      const slug = `code::${row.contributor_codeset_key}::${row.contributor_codeset_code_key}`;
      const existing = slugToRows.get(slug) ?? [];
      existing.push(row);
      slugToRows.set(slug, existing);
    }

    const slugToId = new Map<string, number>();

    for (const reference of codeReferences) {
      const matches = slugToRows.get(reference.slug) ?? [];
      if (!matches.length) {
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

      if (matches.length > 1) {
        throw new ApiExecuteSQLError(
          'Ambiguous code slug resolution across multiple rows. Each contributor codeset key and codeset code key must be unique.',
          [
            'SubmissionFeaturePropertyIndexService->resolveContributorCodesetCodeIdsByCodeReferences',
            {
              contributorId,
              slug: reference.slug,
              advice: 'Use a new key when creating a new external_id.'
            }
          ]
        );
      }

      slugToId.set(reference.slug, matches[0].contributor_codeset_code_id);
    }

    return slugToId;
  }

  private toContributorCodesetDefinitions(
    contributorId: number,
    codesets: Record<string, unknown>,
    referencedCodeKeys: Map<string, Set<string>>
  ): CreateContributorCodeset[] {
    const definitions: CreateContributorCodeset[] = [];

    for (const contributorCodesetKey of referencedCodeKeys.keys()) {
      const rawContributorCodeset = codesets[contributorCodesetKey];
      if (typeof rawContributorCodeset !== 'object' || rawContributorCodeset === null) {
        throw new ApiExecuteSQLError('Invalid contributor codeset payload', [
          'SubmissionFeaturePropertyIndexService->toContributorCodesetDefinitions',
          { contributorCodesetKey }
        ]);
      }

      const contributorCodeset = rawContributorCodeset as Record<string, unknown>;
      const externalId = this.normalizeExternalId(contributorCodeset);
      const label = this.normalizeRequiredLabel(contributorCodeset.label, `codesets.${contributorCodesetKey}.label`);
      const description = this.normalizeDescription(contributorCodeset.description);

      definitions.push({
        contributor_id: contributorId,
        key: contributorCodesetKey,
        external_id: externalId,
        label,
        description
      });
    }

    return definitions;
  }

  private toContributorCodesetCodeDefinitions(
    codesets: Record<string, unknown>,
    existingCodesets: ContributorCodeset[],
    referencedCodeKeys: Map<string, Set<string>>
  ): CreateContributorCodesetCodeDefinition[] {
    const definitions: CreateContributorCodesetCodeDefinition[] = [];
    const contributorCodesetsByKey = new Map<string, ContributorCodeset>();

    for (const contributorCodeset of existingCodesets) {
      const existing = contributorCodesetsByKey.get(contributorCodeset.key);
      if (existing) {
        throw new ApiExecuteSQLError('Ambiguous contributor codeset key resolution', [
          'SubmissionFeaturePropertyIndexService->toContributorCodesetCodeDefinitions',
          {
            contributorCodesetKey: contributorCodeset.key,
            advice: 'Use a unique contributor codeset key per contributor.'
          }
        ]);
      }

      contributorCodesetsByKey.set(contributorCodeset.key, contributorCodeset);
    }

    for (const [contributorCodesetKey, referencedCodesetCodeKeys] of referencedCodeKeys.entries()) {
      const rawContributorCodeset = codesets[contributorCodesetKey];
      const contributorCodesetPayload = rawContributorCodeset as Record<string, unknown>;
      const contributorCodesetExternalId = String(contributorCodesetPayload.external_id ?? '').trim();
      const contributorCodeset = contributorCodesetsByKey.get(contributorCodesetKey);

      if (!contributorCodeset) {
        throw new ApiExecuteSQLError('Failed to resolve contributor codeset row after upsert', [
          'SubmissionFeaturePropertyIndexService->toContributorCodesetCodeDefinitions',
          {
            contributorCodesetKey,
            contributorCodesetExternalId
          }
        ]);
      }

      const codes =
        typeof contributorCodesetPayload.codes === 'object' && contributorCodesetPayload.codes !== null
          ? (contributorCodesetPayload.codes as Record<string, unknown>)
          : {};

      for (const contributorCodesetCodeKey of referencedCodesetCodeKeys) {
        const rawCode = codes[contributorCodesetCodeKey];
        if (typeof rawCode !== 'object' || rawCode === null) {
          throw new ApiExecuteSQLError('Invalid contributor code payload', [
            'SubmissionFeaturePropertyIndexService->toContributorCodesetCodeDefinitions',
            {
              contributorCodesetKey,
              contributorCodesetCodeKey
            }
          ]);
        }

        const code = rawCode as Record<string, unknown>;
        const codeExternalId = this.normalizeExternalId(code);

        definitions.push({
          contributor_codeset_id: contributorCodeset.contributor_codeset_id,
          contributor_codeset_key: contributorCodesetKey,
          key: contributorCodesetCodeKey,
          external_id: codeExternalId,
          label: this.normalizeRequiredLabel(
            code.label,
            `codesets.${contributorCodesetKey}.codes.${contributorCodesetCodeKey}.label`
          ),
          description: this.normalizeDescription(code.description)
        });
      }
    }

    return definitions;
  }

  private makeContributorCodesetCodeIdentityKey(payload: { contributor_codeset_id: number; key: string }): string {
    return `${payload.contributor_codeset_id}::${payload.key}`;
  }

  private normalizeRequiredLabel(value: unknown, path: string): string {
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase();
    }

    throw new ApiExecuteSQLError('Contributor label is required', [
      'SubmissionFeaturePropertyIndexService->normalizeRequiredLabel',
      {
        path,
        advice: 'Provide a non-empty label for referenced contributor codesets/codes.'
      }
    ]);
  }

  private normalizeExternalId(payload: Record<string, unknown>): string | null {
    const value = typeof payload.external_id === 'string' ? payload.external_id : null;

    if (!value || !value.trim()) {
      return null;
    }

    return value.trim();
  }

  private toReferencedCodeKeys(codeReferences: CodeReference[]): Map<string, Set<string>> {
    const referenced = new Map<string, Set<string>>();

    for (const codeReference of codeReferences) {
      const existing = referenced.get(codeReference.contributorCodesetKey) ?? new Set<string>();
      existing.add(codeReference.contributorCodesetCodeKey);
      referenced.set(codeReference.contributorCodesetKey, existing);
    }

    return referenced;
  }

  private normalizeDescription(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase();
    }

    return null;
  }

  private mapCodesToSlugMap(
    definitions: CreateContributorCodesetCodeDefinition[],
    resolvedRows: ContributorCodesetCode[]
  ): Map<string, number> {
    const byIdentity = new Map<string, ContributorCodesetCode>();

    for (const row of resolvedRows) {
      byIdentity.set(this.makeContributorCodesetCodeIdentityKey(row), row);
    }

    const slugMap = new Map<string, number>();

    for (const definition of definitions) {
      const resolved = byIdentity.get(this.makeContributorCodesetCodeIdentityKey(definition));

      if (!resolved) {
        throw new ApiExecuteSQLError('Failed to resolve contributor code row after upsert', [
          'SubmissionFeaturePropertyIndexService->mapCodesToSlugMap',
          {
            contributor_codeset_id: definition.contributor_codeset_id,
            key: definition.key,
            external_id: definition.external_id
          }
        ]);
      }

      const slug = `code::${definition.contributor_codeset_key}::${definition.key}`;
      slugMap.set(slug, resolved.contributor_codeset_code_id);
    }

    return slugMap;
  }
}
