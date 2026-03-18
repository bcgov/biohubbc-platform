import { Feature } from 'geojson';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ContributorCodeset } from '../models/contributor-codeset';
import { ContributorCodesetCode, ContributorCodesetCodeSchema } from '../models/contributor-codeset-code';
import {
  ContributorCodeResolution,
  CreateContributorCodeset,
  CreateContributorCodesetCode,
  FeatureTypePropertyMetadata
} from '../models/submission-feature-property-index';
import { ContributorCodesetCodeService } from '../services/contributor-codeset-code-service';
import { ContributorCodesetService } from '../services/contributor-codeset-service';
import {
  InsertSubmissionFeaturePropertyBoolean,
  InsertSubmissionFeaturePropertyCode,
  InsertSubmissionFeaturePropertyGeometry,
  InsertSubmissionFeaturePropertyNumber,
  InsertSubmissionFeaturePropertyString,
  InsertSubmissionFeaturePropertyTaxon,
  InsertSubmissionFeaturePropertyTimestamp
} from '../services/search-feature-service.interface';
import { CodeReference } from '../utils/code-reference';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

/**
 * Repository for canonical submission feature property indexing operations.
 *
 * @export
 * @class SubmissionFeaturePropertyIndexRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeaturePropertyIndexRepository extends BaseRepository {
  /**
   * Persist contributor codeset definitions and codes in bulk for a submission.
   *
   * Why:
   * - Processing must persist code dependencies so indexing can be DB-only.
   * - Immutable-definition semantics are enforced during persistence.
   *
   * @param {number} contributorId
   * @param {Record<string, unknown>} codesets
   * @return {Promise<Map<string, number>>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
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

  /**
   * Get active feature type property metadata for provided feature types.
   *
   * @param {number[]} featureTypeIds
   * @return {Promise<FeatureTypePropertyMetadata[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async getFeatureTypePropertyMetadata(featureTypeIds: number[]): Promise<FeatureTypePropertyMetadata[]> {
    if (!featureTypeIds.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('feature_type_property as ftp')
      .select([
        'ftp.feature_type_id',
        'ftp.feature_type_property_id',
        'ftp.allow_multiple',
        'fp.name as feature_property_name',
        'fpt.name as feature_property_type_name'
      ])
      .innerJoin('feature_property as fp', 'fp.feature_property_id', 'ftp.feature_property_id')
      .innerJoin('feature_property_type as fpt', 'fpt.feature_property_type_id', 'fp.feature_property_type_id')
      .whereIn('ftp.feature_type_id', featureTypeIds)
      .whereNull('ftp.record_end_date')
      .whereNull('fp.record_end_date')
      .whereNull('fpt.record_end_date');

    const response = await this.connection.knex(query, FeatureTypePropertyMetadata);

    return response.rows;
  }

  /**
   * Delete all canonical property records for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async deletePropertyRecordsBySubmissionId(submissionId: number): Promise<void> {
    const knex = getKnex();
    const featureIdsQuery = knex
      .select('submission_feature_id')
      .from('submission_feature')
      .where('submission_id', submissionId);

    const cteFeatureIds = knex.select('submission_feature_id').from('feature_ids');

    const query = knex
      .with('feature_ids', featureIdsQuery)
      .with('deleted_string', (qb) => {
        qb.from('submission_feature_property_string').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_number', (qb) => {
        qb.from('submission_feature_property_number').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_boolean', (qb) => {
        qb.from('submission_feature_property_boolean').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_timestamp', (qb) => {
        qb.from('submission_feature_property_timestamp').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_code', (qb) => {
        qb.from('submission_feature_property_code').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_taxon', (qb) => {
        qb.from('submission_feature_property_taxon').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_geometry', (qb) => {
        qb.from('submission_feature_property_geometry').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .select(knex.raw('1'));

    await this.connection.knex(query);
  }

  /**
   * Find contributor codeset code rows by ids.
   *
   * @param {number[]} contributorCodesetCodeIds
   * @return {Promise<ContributorCodesetCode[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async findContributorCodesetCodesByIds(contributorCodesetCodeIds: number[]): Promise<ContributorCodesetCode[]> {
    if (!contributorCodesetCodeIds.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('contributor_codeset_code')
      .select([
        'contributor_codeset_code_id',
        'contributor_codeset_id',
        'key',
        'version as external_id',
        'label',
        'description'
      ])
      .whereIn('contributor_codeset_code_id', contributorCodesetCodeIds);
    const response = await this.connection.knex(query, ContributorCodesetCodeSchema);

    return response.rows;
  }

  /**
   * Resolve contributor_codeset_code IDs for code references in bulk.
   *
   * Why:
   * - Property indexing must not read codeset artifacts from object storage.
   * - We load only contributor codesets referenced by the current submission, then map
   *   slugs to IDs in memory for O(1) assignment while inserting code properties.
   *
   * @param {number} contributorId
   * @param {CodeReference[]} codeReferences
   * @return {Promise<Map<string, number>>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
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

    const knex = getKnex();
    const codesQuery = knex('contributor_codeset_code as ccc')
      .select([
        'ccc.contributor_codeset_code_id',
        'ccs.key as contributor_codeset_key',
        'ccc.key as contributor_codeset_code_key'
      ])
      .innerJoin('contributor_codeset as ccs', 'ccs.contributor_codeset_id', 'ccc.contributor_codeset_id')
      .where('ccs.contributor_id', contributorId)
      .whereNull('ccs.record_end_date')
      .whereNull('ccc.record_end_date')
      .whereIn('ccs.key', uniqueContributorCodesetKeys);

    const codesResponse = await this.connection.knex(codesQuery, ContributorCodeResolution);
    const slugToRows = new Map<string, typeof codesResponse.rows>();

    for (const row of codesResponse.rows) {
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
            'SubmissionFeaturePropertyIndexRepository->resolveContributorCodesetCodeIdsByCodeReferences',
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
            'SubmissionFeaturePropertyIndexRepository->resolveContributorCodesetCodeIdsByCodeReferences',
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

  /**
   * Build normalized contributor codeset definitions from parsed codeset payload.
   *
   * @private
   * @param {number} contributorId
   * @param {Record<string, unknown>} codesets
   * @return {CreateContributorCodeset[]}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
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
          'SubmissionFeaturePropertyIndexRepository->toContributorCodesetDefinitions',
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

  /**
   * Build normalized contributor code definitions from parsed codeset payload and resolved categories.
   *
   * @private
   * @param {Record<string, unknown>} codesets
   * @param {Map<string, ContributorCodeset>} codesetsByIdentity
   * @return {CreateContributorCodesetCode[]}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  private toContributorCodesetCodeDefinitions(
    codesets: Record<string, unknown>,
    existingCodesets: ContributorCodeset[],
    referencedCodeKeys: Map<string, Set<string>>
  ): CreateContributorCodesetCode[] {
    const definitions: CreateContributorCodesetCode[] = [];
    const contributorCodesetsByKey = new Map<string, ContributorCodeset>();

    for (const contributorCodeset of existingCodesets) {
      const existing = contributorCodesetsByKey.get(contributorCodeset.key);
      if (existing) {
        throw new ApiExecuteSQLError('Ambiguous contributor codeset key resolution', [
          'SubmissionFeaturePropertyIndexRepository->toContributorCodesetCodeDefinitions',
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
          'SubmissionFeaturePropertyIndexRepository->toContributorCodesetCodeDefinitions',
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
            'SubmissionFeaturePropertyIndexRepository->toContributorCodesetCodeDefinitions',
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

  /**
   * Create identity key for contributor codeset_code rows.
   *
   * @private
   * @param {{ contributor_codeset_id: number; key: string }} payload
   * @return {string}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  private makeContributorCodesetCodeIdentityKey(payload: { contributor_codeset_id: number; key: string }): string {
    return `${payload.contributor_codeset_id}::${payload.key}`;
  }

  /**
   * Normalize label values to lowercase and require non-empty input.
   *
   * @private
   * @param {unknown} value
   * @param {string} path
   * @return {string}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  private normalizeRequiredLabel(value: unknown, path: string): string {
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase();
    }

    throw new ApiExecuteSQLError('Contributor label is required', [
      'SubmissionFeaturePropertyIndexRepository->normalizeRequiredLabel',
      {
        path,
        advice: 'Provide a non-empty label for referenced contributor codesets/codes.'
      }
    ]);
  }

  /**
   * Normalize external_id values to lowercase or null.
   *
   * @private
   * @param {Record<string, unknown>} payload
   * @return {(string | null)}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  private normalizeExternalId(payload: Record<string, unknown>): string | null {
    const value = typeof payload.external_id === 'string' ? payload.external_id : null;

    if (!value || !value.trim()) {
      return null;
    }

    return value.trim();
  }

  /**
   * Build a codeset->code-key map from referenced code slugs.
   *
   * @private
   * @param {CodeReference[]} codeReferences
   * @return {Map<string, Set<string>>}
   * @memberof SubmissionFeaturePropertyIndexRepository
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

  /**
   * Normalize optional descriptions to lowercase or null.
   *
   * @private
   * @param {unknown} value
   * @return {(string | null)}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  private normalizeDescription(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase();
    }

    return null;
  }

  /**
   * Build canonical slug map from resolved code rows and expected definitions.
   *
   * @private
   * @param {CreateContributorCodesetCode[]} definitions
   * @param {ContributorCodesetCode[]} resolvedRows
   * @return {Map<string, number>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  private mapCodesToSlugMap(
    definitions: CreateContributorCodesetCode[],
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
          'SubmissionFeaturePropertyIndexRepository->mapCodesToTokenMap',
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

  /**
   * Bulk insert string property records.
   *
   * @param {InsertSubmissionFeaturePropertyString[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertStringRecords(records: InsertSubmissionFeaturePropertyString[]): Promise<void> {
    await this.insertRecords('submission_feature_property_string', records);
  }

  /**
   * Bulk insert number property records.
   *
   * @param {InsertSubmissionFeaturePropertyNumber[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertNumberRecords(records: InsertSubmissionFeaturePropertyNumber[]): Promise<void> {
    await this.insertRecords('submission_feature_property_number', records);
  }

  /**
   * Bulk insert boolean property records.
   *
   * @param {InsertSubmissionFeaturePropertyBoolean[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertBooleanRecords(records: InsertSubmissionFeaturePropertyBoolean[]): Promise<void> {
    await this.insertRecords('submission_feature_property_boolean', records);
  }

  /**
   * Bulk insert timestamp property records.
   *
   * @param {InsertSubmissionFeaturePropertyTimestamp[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertTimestampRecords(records: InsertSubmissionFeaturePropertyTimestamp[]): Promise<void> {
    await this.insertRecords('submission_feature_property_timestamp', records);
  }

  /**
   * Bulk insert code property records.
   *
   * @param {InsertSubmissionFeaturePropertyCode[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertCodeRecords(records: InsertSubmissionFeaturePropertyCode[]): Promise<void> {
    await this.insertRecords('submission_feature_property_code', records);
  }

  /**
   * Bulk insert taxon property records.
   *
   * @param {InsertSubmissionFeaturePropertyTaxon[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertTaxonRecords(records: InsertSubmissionFeaturePropertyTaxon[]): Promise<void> {
    await this.insertRecords('submission_feature_property_taxon', records);
  }

  /**
   * Bulk insert geometry property records.
   *
   * @param {InsertSubmissionFeaturePropertyGeometry[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertGeometryRecords(records: InsertSubmissionFeaturePropertyGeometry[]): Promise<void> {
    if (!records.length) {
      return;
    }

    const query = SQL`INSERT INTO submission_feature_property_geometry (submission_feature_id, feature_type_property_id, value) VALUES`;

    records.forEach((record, index) => {
      query.append(SQL`(${record.submission_feature_id}, ${record.feature_type_property_id},`);
      query.append(generateGeometryCollectionSQL(record.value as Feature));
      query.append(SQL`)`);
      if (index < records.length - 1) {
        query.append(SQL`,`);
      }
    });

    const response = await this.connection.sql(query);

    if (response.rowCount !== records.length) {
      throw new ApiExecuteSQLError('Failed to insert submission feature geometry records', [
        'SubmissionFeaturePropertyIndexRepository->insertGeometryRecords',
        `rowCount was ${response.rowCount}, expected ${records.length}`
      ]);
    }
  }

  /**
   * Bulk insert records to a canonical property table.
   *
   * @private
   * @template T
   * @param {string} table
   * @param {T[]} records
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  private async insertRecords<T>(table: string, records: T[]): Promise<void> {
    if (!records.length) {
      return;
    }

    const knex = getKnex();
    const query = knex(table).insert(records);
    const response = await this.connection.knex(query);

    if (response.rowCount !== records.length) {
      throw new ApiExecuteSQLError(`Failed to insert ${table} records`, [
        'SubmissionFeaturePropertyIndexRepository->insertRecords',
        `rowCount was ${response.rowCount}, expected ${records.length}`
      ]);
    }
  }
}
