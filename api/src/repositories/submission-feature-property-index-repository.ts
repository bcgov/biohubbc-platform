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
   * Get existing code IDs for validation.
   *
   * @param {number[]} codeIds
   * @return {Promise<number[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async getExistingCodeIds(codeIds: number[]): Promise<number[]> {
    if (!codeIds.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('code').select('code_id').whereIn('code_id', codeIds);
    const response = await this.connection.knex<{ code_id: number }>(query);

    return response.rows.map((row) => row.code_id);
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
