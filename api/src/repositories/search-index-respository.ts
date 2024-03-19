import { Feature } from 'geojson';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { getLogger } from '../utils/logger';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { GeoJSONFeatureCollectionZodSchema } from '../zod-schema/geoJsonZodSchema';
import { shallowJsonSchema } from '../zod-schema/json';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/search-index-repository');

export const FeaturePropertyRecord = z.object({
  feature_property_id: z.number(),
  feature_property_type_id: z.number(),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  parent_feature_property_id: z.number().nullable(),
  calculated_value: z.boolean(),
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
  submission_feature_id: true,
  feature_property_id: true,
  value: true
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
export const InsertSpatialSearchableRecord = SpatialSearchableRecord.pick(InsertSearchableRecordKeys).extend({
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

export const SubmissionFeatureSearchKeyValues = z.object({
  search_id: z.number(),
  submission_feature_id: z.number(),
  feature_property_id: z.number(),
  feature_property_name: z.string(),
  value: z.union([z.string(), z.number(), shallowJsonSchema])
});

export type SubmissionFeatureSearchKeyValues = z.infer<typeof SubmissionFeatureSearchKeyValues>;

export const SubmissionFeatureCombinedSearchValues = z.object({
  search_string_id: z.number(),
  submission_feature_id: z.number(),
  feature_property_id: z.number(),
  string_value: z.string(),
  number_value: z.number(),
  datetime_value: z.string(),
  spatial_value: z.string()
});

export type SubmissionFeatureCombinedSearchValues = z.infer<typeof SubmissionFeatureCombinedSearchValues>;

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
      const { submission_feature_id, feature_property_id, value } = spatialRecord;

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

  /**
   * Retrieves all search values, for all search types (string, number, datetime, spatial), for the given submission
   * feature in one unified result set.
   *
   * @param {number} submissionFeatureId
   * @return {*}  {Promise<SubmissionFeatureCombinedSearchValues[]>}
   * @memberof SearchIndexRepository
   */
  async getCombinedSearchKeyValuesBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeatureCombinedSearchValues[]> {
    const sqlStatement = SQL`
      SELECT
        search_string_id as search_id,
        submission_feature_id,
        feature_property_id,
        value AS string_value,
        null::numeric AS number_value,
        null::timestamptz(6) AS datetime_value,
        null::public.geometry AS spatial_value
      FROM 
        search_string 
      WHERE 
        submission_feature_id = ${submissionFeatureId}
      UNION ALL
      SELECT
        search_number_id as search_id,
        submission_feature_id,
        feature_property_id,
        null AS string_value,
        value AS number_value,
        null::timestamptz(6) AS datetime_value,
        null::public.geometry AS spatial_value
      FROM 
        search_number 
      WHERE 
        submission_feature_id = ${submissionFeatureId}
      UNION ALL
      SELECT
        search_datetime_id as search_id,
        submission_feature_id,
        feature_property_id,
        null AS string_value,
        null::numeric AS number_value,
        value AS datetime_value,
        null::public.geometry AS spatial_value
      FROM 
        search_datetime
      WHERE
        submission_feature_id = ${submissionFeatureId}
      UNION ALL
      SELECT
        search_spatial_id as search_id,
        submission_feature_id,
        feature_property_id,
        null AS string_value,
        null::numeric AS number_value,
        null::timestamptz(6) AS datetime_value,
        value AS spatial_value
      FROM 
        search_spatial
      WHERE
        submission_feature_id = ${submissionFeatureId};
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureCombinedSearchValues);

    return response.rows;
  }

  /**
   * Retrieves all search values, for all search types (string, number, datetime, spatial), for the given submission
   * feature in one unified result set.
   *
   * @param {number} submissionFeatureId
   * @return {*}  {Promise<SubmissionFeatureSearchKeyValues[]>}
   * @memberof SearchIndexRepository
   */
  async getSearchKeyValuesBySubmissionId(submissionId: number): Promise<SubmissionFeatureSearchKeyValues[]> {
    const sqlStatement = SQL`
      with w_submission_features as (
        select submission_feature_id from submission_feature where submission_id = ${submissionId}
      )
      SELECT
        search_string.search_string_id as search_id,
        search_string.submission_feature_id,
        search_string.feature_property_id,
        feature_property.name as feature_property_name,
        search_string.value
      FROM 
      w_submission_features
        inner join
      search_string
       on w_submission_features.submission_feature_id = search_string.submission_feature_id 
        inner join 
      feature_property
        on search_string.feature_property_id = feature_property.feature_property_id 
      UNION ALL
      SELECT
        search_number.search_number_id as search_id,
        search_number.submission_feature_id,
        search_number.feature_property_id,
        feature_property.name as feature_property_name,
        search_number.value::text
      from
      w_submission_features
        inner join
      search_number
       on w_submission_features.submission_feature_id = search_number.submission_feature_id 
        inner join 
      feature_property
        on search_number.feature_property_id = feature_property.feature_property_id 
      UNION ALL
      SELECT
        search_datetime.search_datetime_id as search_id,
        search_datetime.submission_feature_id,
        search_datetime.feature_property_id,
        feature_property.name as feature_property_name,
        search_datetime.value::text
      from
      w_submission_features
        inner join
      search_datetime
       on w_submission_features.submission_feature_id = search_datetime.submission_feature_id 
        inner join 
      feature_property
        on search_datetime.feature_property_id = feature_property.feature_property_id 
      UNION ALL
      SELECT
        search_spatial.search_spatial_id as search_id,
        search_spatial.submission_feature_id,
        search_spatial.feature_property_id,
        feature_property.name as feature_property_name,
        search_spatial.value::json::text
      from
      w_submission_features
        inner join
      search_spatial
       on w_submission_features.submission_feature_id = search_spatial.submission_feature_id
         inner join 
      feature_property
        on search_spatial.feature_property_id = feature_property.feature_property_id;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureSearchKeyValues);

    return response.rows;
  }
}
