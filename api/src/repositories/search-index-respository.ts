import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { getLogger } from '../utils/logger';
import { BaseRepository } from './base-repository';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { GeoJSONFeatureCollectionZodSchema } from '../zod-schema/geoJsonZodSchema';
import { Feature } from 'geojson';

const defaultLog = getLogger('repositories/search-index-repository');

const FeaturePropertyRecord = z.object({
  feature_property_id: z.number(),
  feature_property_type_id: z.number(),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  parent_feature_property_id: z.number().nullable(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.string().nullable(),
  revision_count: z.number()
});

export type FeaturePropertyRecord = z.infer<typeof FeaturePropertyRecord>;

const FeaturePropertyRecordWithPropertyTypeName = FeaturePropertyRecord.extend({
  feature_property_type_name: z.string()
});

export type FeaturePropertyRecordWithPropertyTypeName = z.infer<typeof FeaturePropertyRecordWithPropertyTypeName>;

/**
 * Represents a record in one of the search tables.
 */
const SearchableRecord = z.object({
  submission_feature_id: z.number(),
  feature_property_id: z.number(),
  value: z.unknown(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.string().nullable(),
  revision_count: z.number()
});

export type SearchableRecord = z.infer<typeof SearchableRecord>;

const InsertSearchableRecordKeys = {
  'submission_feature_id': true,
  'feature_property_id': true,
  'value': true
} as const;

/**
 * Represents a record in the datetime search table.
 */
export const DatetimeSearchableRecord = SearchableRecord.extend({
  search_datetime_id: z.number(),
  value: z.string()
});

/**
 * Represents a record in the number search table.
 */
export const NumberSearchableRecord = SearchableRecord.extend({
  search_number_id: z.number(),
  value: z.number()
});

/**
 * Represents a record in the string search table.
 */
export const StringSearchableRecord = SearchableRecord.extend({
  search_string_id: z.number(),
  value: z.string()
});

/**
 * Represents a record in the spatial search table.
 * 
 * Because values from a type `geometry` column are not useful, we elect to never
 * return them (`z.never()`).
 */
export const SpatialSearchableRecord = SearchableRecord.extend({
  search_spatial_id: z.number(),
  value: z.never() // Geometry represented as a string
});

export const InsertDatetimeSearchableRecord = DatetimeSearchableRecord.pick(InsertSearchableRecordKeys);
export const InsertNumberSearchableRecord = NumberSearchableRecord.pick(InsertSearchableRecordKeys);
export const InsertStringSearchableRecord = StringSearchableRecord.pick(InsertSearchableRecordKeys);
export const InsertSpatialSearchableRecord = SpatialSearchableRecord.pick(InsertSearchableRecordKeys)
  .extend({
    value: GeoJSONFeatureCollectionZodSchema
  });

export type DatetimeSearchableRecord = z.infer<typeof DatetimeSearchableRecord>;
export type NumberSearchableRecord = z.infer<typeof NumberSearchableRecord>;
export type StringSearchableRecord = z.infer<typeof StringSearchableRecord>;
export type SpatialSearchableRecord = z.infer<typeof SpatialSearchableRecord>;

export type InsertDatetimeSearchableRecord = z.infer<typeof InsertDatetimeSearchableRecord>;
export type InsertNumberSearchableRecord = z.infer<typeof InsertNumberSearchableRecord>;
export type InsertStringSearchableRecord = z.infer<typeof InsertStringSearchableRecord>;
export type InsertSpatialSearchableRecord = z.infer<typeof InsertSpatialSearchableRecord>;

/**
 * A class for creating searchable records
 */
export class SearchIndexRepository extends BaseRepository {
  /**
   * Inserts a searchable datetime record.
   *
   * @param {InsertDatetimeSearchableRecord[]} datetimeRecords
   * @return {*}  {Promise<DatetimeSearchableRecord[]>}
   * @memberof SearchIndexRepository
   */
  async insertSearchableDatetimeRecords(
    datetimeRecords: InsertDatetimeSearchableRecord[]
  ): Promise<DatetimeSearchableRecord[]> {
    defaultLog.debug({ label: 'insertSearchableDatetimeRecords' });

    const queryBuilder = getKnex().queryBuilder().insert(datetimeRecords).into('search_datetime').returning('*');

    const response = await this.connection.knex(queryBuilder, DatetimeSearchableRecord);

    if (response.rowCount !== datetimeRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable datetime records', [
        'SearchIndexRepository->insertSearchableDatetimeRecords',
        'rowCount did not match number of supplied records to insert'
      ]);
    }

    return response.rows;
  }

  /**
   * Inserts a searchable number record.
   *
   * @param {InsertNumberSearchableRecord[]} numberRecords
   * @return {*}  {Promise<NumberSearchableRecord[]>}
   * @memberof SearchIndexRepository
   */
  async insertSearchableNumberRecords(
    numberRecords: InsertNumberSearchableRecord[]
  ): Promise<NumberSearchableRecord[]> {
    defaultLog.debug({ label: 'insertSearchableNumberRecords' });

    const queryBuilder = getKnex().queryBuilder().insert(numberRecords).into('search_number').returning('*');

    const response = await this.connection.knex(queryBuilder, NumberSearchableRecord);

    if (response.rowCount !== numberRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable number records', [
        'SearchIndexRepository->insertSearchableNumberRecords',
        'rowCount did not match number of supplied records to insert'
      ]);
    }

    return response.rows;
  }

  /**
   * Inserts a searchable spatial record.
   *
   * @param {InsertSpatialSearchableRecord[]} spatialRecords
   * @return {*}  {Promise<SpatialSearchableRecord[]>}
   * @memberof SearchIndexRepository
   */
  async insertSearchableSpatialRecords(
    spatialRecords: InsertSpatialSearchableRecord[]
  ): Promise<SpatialSearchableRecord[]> {
    defaultLog.debug({ label: 'insertSearchableSpatialRecords' });

    const query = SQL`
      INSERT INTO
        search_spatial
      (
        submission_feature_id,
        feature_property_id,
        value
      )
        VALUES
    `;

    spatialRecords.forEach((spatialRecord, index) => {
      const {
        submission_feature_id,
        feature_property_id,
        value
      } = spatialRecord;

      query.append(SQL`(
        ${submission_feature_id},
        ${feature_property_id},`);
      query.append(generateGeometryCollectionSQL(value.features as Feature[]));
      query.append(SQL`)`);
      
      if (index < spatialRecords.length - 1) {
        query.append(SQL`,`);
      }
    });

    const response = await this.connection.sql(query, SpatialSearchableRecord);

    if (response.rowCount !== spatialRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable spatial records', [
        'SearchIndexRepository->insertSearchableSpatialRecords',
        'rowCount did not match number of supplied records to insert'
      ]);
    }

    return response.rows;
  }

  /**
   * Inserts a searchable string record.
   *
   * @param {InsertStringSearchableRecord[]} stringRecords
   * @return {*}  {Promise<StringSearchableRecord[]>}
   * @memberof SearchIndexRepository
   */
  async insertSearchableStringRecords(
    stringRecords: InsertStringSearchableRecord[]
  ): Promise<StringSearchableRecord[]> {
    defaultLog.debug({ label: 'insertSearchableStringRecords' });

    const queryBuilder = getKnex().queryBuilder().insert(stringRecords).into('search_string').returning('*');

    const response = await this.connection.knex(queryBuilder, StringSearchableRecord);

    if (response.rowCount !== stringRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable string records', [
        'SearchIndexRepository->insertSearchableStringRecords',
        'rowCount did not match number of supplied records to insert'
      ]);
    }

    return response.rows;
  }

  /**
   * Retrieves all feature properties, with each property's type name (e.g. string, datetime, number) joined
   * to it.
   *
   * @return {*}  {Promise<FeaturePropertyRecordWithPropertyTypeName[]>}
   * @memberof SearchIndexRepository
   */
  async getFeaturePropertiesWithTypeNames(): Promise<FeaturePropertyRecordWithPropertyTypeName[]> {
    const query = SQL`
    SELECT
      fpt.name as feature_property_type_name,
      fp.*
    FROM
      feature_property fp
    LEFT JOIN 
      feature_property_type fpt
    ON
      fp.feature_property_type_id = fpt.feature_property_type_id
    WHERE
      fp.record_end_date IS NULL
    AND
      fpt.record_end_date IS NULL
    `;

    const response = await this.connection.sql(query, FeaturePropertyRecordWithPropertyTypeName);

    return response.rows;
  }
}
