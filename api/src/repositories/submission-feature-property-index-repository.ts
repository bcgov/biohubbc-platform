import { Feature } from 'geojson';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  FeatureTypePropertyMetadataRow,
  InsertSubmissionFeaturePropertyBoolean,
  InsertSubmissionFeaturePropertyCode,
  InsertSubmissionFeaturePropertyGeometry,
  InsertSubmissionFeaturePropertyNumber,
  InsertSubmissionFeaturePropertyString,
  InsertSubmissionFeaturePropertyTaxon,
  InsertSubmissionFeaturePropertyTimestamp
} from '../services/search-feature-service.interface';
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
   * Get active feature type property metadata for provided feature types.
   *
   * @param {number[]} featureTypeIds
   * @return {Promise<FeatureTypePropertyMetadataRow[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async getFeatureTypePropertyMetadata(featureTypeIds: number[]): Promise<FeatureTypePropertyMetadataRow[]> {
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

    const response = await this.connection.knex<FeatureTypePropertyMetadataRow>(query);

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
    const tables = [
      'submission_feature_property_string',
      'submission_feature_property_number',
      'submission_feature_property_boolean',
      'submission_feature_property_timestamp',
      'submission_feature_property_code',
      'submission_feature_property_taxon',
      'submission_feature_property_geometry'
    ];

    const knex = getKnex();
    const featureIdSubquery = knex
      .select('submission_feature_id')
      .from('submission_feature')
      .where('submission_id', submissionId);

    await Promise.all(
      tables.map((table) =>
        this.connection.knex(knex(table).whereIn('submission_feature_id', featureIdSubquery).delete())
      )
    );
  }

  /**
   * Get existing contributor_codeset_code IDs for validation.
   *
   * NOTE: This method should be replaced by the redundant method from ContributorCodesetCodeRepository, and the redundant method should be removed from that repository, once available.
   *
   * @param {number[]} contributorCodesetCodeIds
   * @return {Promise<number[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async getExistingContributorCodesetCodeIds(contributorCodesetCodeIds: number[]): Promise<number[]> {
    if (!contributorCodesetCodeIds.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('contributor_codeset_code')
      .select('contributor_codeset_code_id')
      .whereIn('contributor_codeset_code_id', contributorCodesetCodeIds);
    const response = await this.connection.knex<{ contributor_codeset_code_id: number }>(query);

    return response.rows.map((row) => row.contributor_codeset_code_id);
  }

  /**
   * Resolve contributor_codeset_code IDs for parsed code tokens in bulk.
   *
   * Contributor systems must provide explicit versioned contributor_codeset rows.
   * This resolver does not invent versions. It resolves a unique active category row
   * per category key, then upserts contributor_codeset_code rows using that category version.
   *
   * @param {number} submissionId
   * @param {Array<{ categoryKey: string; categoryCodeKey: string }>} tokens
   * @return {Promise<Map<string, number>>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async resolveContributorCodesetCodeIdsByTokens(
    submissionId: number,
    tokens: Array<{ categoryKey: string; categoryCodeKey: string }>
  ): Promise<Map<string, number>> {
    if (!tokens.length) {
      return new Map<string, number>();
    }

    const knex = getKnex();

    const uniqueCategoryKeys = [...new Set(tokens.map((token) => token.categoryKey))];
    const uniqueTokenPairs = [...new Set(tokens.map((token) => `${token.categoryKey}::${token.categoryCodeKey}`))].map(
      (pair) => {
        const split = pair.split('::');
        return { categoryKey: split[0], categoryCodeKey: split[1] };
      }
    );

    // Resolve contributor_id for the submission's source system user.
    const contributorIdQuery = knex('submission as s')
      .select('csu.contributor_id')
      .innerJoin('contributor_system_user as csu', 'csu.system_user_id', 's.system_user_id')
      .where('s.submission_id', submissionId)
      .whereNull('s.record_end_date')
      .whereNull('csu.record_end_date')
      .first();

    const contributorIdResponse = await this.connection.knex<{ contributor_id: number }>(contributorIdQuery);
    const contributorId = contributorIdResponse.rows[0]?.contributor_id;

    if (!contributorId) {
      throw new ApiExecuteSQLError(
        'Failed to resolve contributor for submission. Ensure the submission system_user is mapped in contributor_system_user.',
        ['SubmissionFeaturePropertyIndexRepository->resolveContributorCodesetCodeIdsByTokens', { submissionId }]
      );
    }

    const contributorCodesetRowsQuery = knex('contributor_codeset')
      .select('contributor_codeset_id', 'key', 'version')
      .where('contributor_id', contributorId)
      .whereNull('record_end_date')
      .whereIn('key', uniqueCategoryKeys);

    const contributorCodesetRows = await this.connection.knex<{
      contributor_codeset_id: number;
      key: string;
      version: string;
    }>(contributorCodesetRowsQuery);

    const contributorCodesetRowsByCategory = new Map<
      string,
      Array<{ contributor_codeset_id: number; version: string }>
    >();
    for (const row of contributorCodesetRows.rows) {
      const existing = contributorCodesetRowsByCategory.get(row.key) ?? [];
      existing.push({ contributor_codeset_id: row.contributor_codeset_id, version: row.version });
      contributorCodesetRowsByCategory.set(row.key, existing);
    }

    const resolvedContributorCodesetByCategory = new Map<string, { contributor_codeset_id: number; version: string }>();
    for (const categoryKey of uniqueCategoryKeys) {
      const matches = contributorCodesetRowsByCategory.get(categoryKey) ?? [];

      if (!matches.length) {
        throw new ApiExecuteSQLError(
          'Missing contributor_codeset category definition with explicit version. Contributors must provide versioned category definitions before code indexing.',
          [
            'SubmissionFeaturePropertyIndexRepository->resolveContributorCodesetCodeIdsByTokens',
            {
              submissionId,
              contributorId,
              categoryKey,
              advice: 'Insert contributor_codeset row with (contributor_id, key, version) before indexing.'
            }
          ]
        );
      }

      if (matches.length > 1) {
        throw new ApiExecuteSQLError(
          'Multiple active contributor_codeset versions found for category key. A single active version is required to resolve code tokens.',
          [
            'SubmissionFeaturePropertyIndexRepository->resolveContributorCodesetCodeIdsByTokens',
            {
              submissionId,
              contributorId,
              categoryKey,
              versions: matches.map((match) => match.version),
              advice: 'Retire old versions or explicitly scope to one active version.'
            }
          ]
        );
      }

      resolvedContributorCodesetByCategory.set(categoryKey, matches[0]);
    }

    // Upsert contributor_codeset_code rows for category/code pairs.
    const contributorCodeInserts = uniqueTokenPairs.map((token) => {
      const resolvedContributorCodeset = resolvedContributorCodesetByCategory.get(token.categoryKey);

      if (!resolvedContributorCodeset) {
        throw new ApiExecuteSQLError('Failed to resolve contributor_codeset_id for category key', [
          'SubmissionFeaturePropertyIndexRepository->resolveContributorCodesetCodeIdsByTokens',
          { submissionId, categoryKey: token.categoryKey }
        ]);
      }

      return {
        contributor_codeset_id: resolvedContributorCodeset.contributor_codeset_id,
        key: token.categoryCodeKey,
        label: token.categoryCodeKey,
        description: null,
        version: resolvedContributorCodeset.version
      };
    });

    await this.connection.knex(
      knex('contributor_codeset_code')
        .insert(contributorCodeInserts)
        .onConflict(['contributor_codeset_id', 'key', 'version'])
        .ignore()
    );

    const contributorCodeRowsQuery = knex('contributor_codeset_code as ccc')
      .select('ccc.contributor_codeset_code_id', 'ccc.key as code_key', 'ccs.key as category_key')
      .innerJoin('contributor_codeset as ccs', 'ccs.contributor_codeset_id', 'ccc.contributor_codeset_id')
      .where('ccs.contributor_id', contributorId)
      .whereNull('ccs.record_end_date')
      .whereNull('ccc.record_end_date')
      .whereIn('ccs.key', uniqueCategoryKeys);

    const contributorCodeRows = await this.connection.knex<{
      contributor_codeset_code_id: number;
      code_key: string;
      category_key: string;
    }>(contributorCodeRowsQuery);

    const resolvedByToken = new Map<string, number>();
    for (const row of contributorCodeRows.rows) {
      resolvedByToken.set(`code::${row.category_key}::${row.code_key}`, row.contributor_codeset_code_id);
    }

    for (const token of uniqueTokenPairs) {
      const tokenKey = `code::${token.categoryKey}::${token.categoryCodeKey}`;
      if (!resolvedByToken.has(tokenKey)) {
        throw new ApiExecuteSQLError('Failed to resolve contributor_codeset_code_id for code token', [
          'SubmissionFeaturePropertyIndexRepository->resolveContributorCodesetCodeIdsByTokens',
          {
            submissionId,
            token: tokenKey,
            advice:
              'Ensure contributor_codeset and contributor_codeset_code tables are available and token keys are valid.'
          }
        ]);
      }
    }

    return resolvedByToken;
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
