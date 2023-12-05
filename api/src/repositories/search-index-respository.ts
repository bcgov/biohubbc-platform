import { z } from "zod";
import { getLogger } from "../utils/logger";
import { BaseRepository } from "./base-repository";

const defaultLog = getLogger('repositories/search-index-repository');

const SearchableRecord = <T>(valueType: z.ZodType<T, any, any>) => z.object({
  search_datetime_id: z.number(),
  submission_feature_id: z.number(),
  feature_property_id: z.number(),
  value: valueType,
  create_date: z.date(),
  create_user: z.number(),
  update_date: z.date().nullable(),
  update_user: z.date().nullable(),
  revision_count: z.number(),
});

// export type SearchableRecordType<T> = z.infer<typeof SearchableRecord<T>>;
export type SearchableRecordType<T> = T extends z.ZodType<infer U, any, any> ? U : never;


type A = SearchableRecordType<string>['create_date']


export const DatetimeSearchableRecord = z.object({
  search_datetime_id: z.number(),
  submission_feature_id: z.number(),
  feature_property_id: z.number(),
  value: z.date(),
  create_date: z.date(),
  create_user: z.number(),
  update_date: z.date().nullable(),
  update_user: z.date().nullable(),
  revision_count: z.number()
});

export type DatetimeSearchableRecord = z.infer<typeof DatetimeSearchableRecord>;

export class SearchIndexRepository extends BaseRepository {

  async createSearchableDatetime(datetimeRecord: CreateDatetime) => {
    //
  }
}
