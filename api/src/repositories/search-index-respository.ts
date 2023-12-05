import { z } from "zod";
import { getLogger } from "../utils/logger";
import { BaseRepository } from "./base-repository";
import { getKnex } from "../database/db";
import { ApiExecuteSQLError } from "../errors/api-error";

const defaultLog = getLogger('repositories/search-index-repository');

const Point = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
});

const SearchableRecord = z.object({
  submission_feature_id: z.number(),
  feature_property_id: z.number(),
  value: z.unknown(),
  create_date: z.date(),
  create_user: z.number(),
  update_date: z.date().nullable(),
  update_user: z.date().nullable(),
  revision_count: z.number(),
});

type InsertSearchableRecordKey = 'value' | 'feature_property_id'

export const DatetimeSearchableRecord = SearchableRecord.extend({
  search_datetime_id: z.date(),
  value: z.date()
});

export const NumberSearchableRecord = SearchableRecord.extend({
  search_number_id: z.number(),
  value: z.number()
});

export const SpatialSearchableRecord = SearchableRecord.extend({
  search_spatial_id: z.number(),
  value: Point
});

export const StringSearchableRecord = SearchableRecord.extend({
  search_string_id: z.number(),
  value: z.string()
});

export type SearchableRecord = z.infer<typeof SearchableRecord>;
export type DatetimeSearchableRecord = z.infer<typeof DatetimeSearchableRecord>;
export type NumberSearchableRecord = z.infer<typeof NumberSearchableRecord>;
export type SpatialSearchableRecord = z.infer<typeof SpatialSearchableRecord>;
export type StringSearchableRecord = z.infer<typeof StringSearchableRecord>;

type InsertDatetimeSearchableRecord = Pick<DatetimeSearchableRecord, InsertSearchableRecordKey>
type InsertNumberSearchableRecord = Pick<DatetimeSearchableRecord, InsertSearchableRecordKey>
type InsertSpatialSearchableRecord = Pick<DatetimeSearchableRecord, InsertSearchableRecordKey>
type InsertStringSearchableRecord = Pick<DatetimeSearchableRecord, InsertSearchableRecordKey>

export class SearchIndexRepository extends BaseRepository {

  async insertSearchableDatetimeRecords(datetimeRecords: InsertDatetimeSearchableRecord[]): Promise<DatetimeSearchableRecord[]> {
    defaultLog.debug({ label: 'insertSearchableDatetimeRecords' });

    const queryBuilder = getKnex()
      .queryBuilder()
      .insert(datetimeRecords)
      .into('search_datetime')
      .returning('*')

    const response = await this.connection.knex<DatetimeSearchableRecord>(queryBuilder);

    if (response.rowCount !== datetimeRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable datetime records', [
        'SearchIndexRepository->insertSearchableDatetimeRecords',
        'rowCount did not match number of supplied records to insert'
      ]);
    }

    return response.rows;
  }

  async insertSearchableNumberRecords(numberRecords: InsertNumberSearchableRecord[]): Promise<NumberSearchableRecord[]> {
    defaultLog.debug({ label: 'insertSearchableNumberRecords' });

    const queryBuilder = getKnex()
      .queryBuilder()
      .insert(numberRecords)
      .into('search_number')
      .returning('*')

    const response = await this.connection.knex<NumberSearchableRecord>(queryBuilder);

    if (response.rowCount !== numberRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable number records', [
        'SearchIndexRepository->insertSearchableNumberRecords',
        'rowCount did not match number of supplied records to insert'
      ]);
    }

    return response.rows;
  }

  async insertSearchableSpatialRecords(spatialRecords: InsertSpatialSearchableRecord[]): Promise<SpatialSearchableRecord[]> {
    defaultLog.debug({ label: 'insertSearchableSpatialRecords' });

    const queryBuilder = getKnex()
      .queryBuilder()
      .insert(spatialRecords)
      .into('search_spatial')
      .returning('*')

    const response = await this.connection.knex<SpatialSearchableRecord>(queryBuilder);

    if (response.rowCount !== spatialRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable spatial records', [
        'SearchIndexRepository->insertSearchableSpatialRecords',
        'rowCount did not match number of supplied records to insert'
      ]);
    }

    return response.rows;
  }

  async insertSearchableStringRecords(stringRecords: InsertStringSearchableRecord[]): Promise<StringSearchableRecord[]> {
    defaultLog.debug({ label: 'insertSearchableStringRecords' });

    const queryBuilder = getKnex()
      .queryBuilder()
      .insert(stringRecords)
      .into('search_string')
      .returning('*')

    const response = await this.connection.knex<StringSearchableRecord>(queryBuilder);

    if (response.rowCount !== stringRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable string records', [
        'SearchIndexRepository->insertSearchableStringRecords',
        'rowCount did not match number of supplied records to insert'
      ]);
    }

    return response.rows;
  }
}
