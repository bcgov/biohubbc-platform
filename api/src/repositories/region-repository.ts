import SQL from 'sql-template-strings';
import { z } from 'zod';
import { BaseRepository } from './base-repository';

export const SubmissionMessageRecord = z.object({
  submission_message_id: z.number(),
  submission_message_type_id: z.number(),
  submission_id: z.number(),
  label: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.any()).nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export const RegionRecord = z.object({
  region_id: z.any(),
  region_name: z.string(),
  org_unit: z.string(),
  org_unit_name: z.string(),
  object_id: z.number(),
  feature_code: z.string(),
  feature_name: z.string(),
  geojson: z.any(),
  geometry: z.any(),
  geography: z.any(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});
export type RegionRecord = z.infer<typeof RegionRecord>;

/**
 * A repository class for accessing region data.
 *
 * @export
 * @class RegionRepository
 * @extends {BaseRepository}
 */
export class RegionRepository extends BaseRepository {
  async getRegions(): Promise<RegionRecord[]> {
    const sql = SQL`
      SELECT * FROM region_lookup
    `;
    const response = await this.connection.sql(sql, RegionRecord);
    return response.rows;
  }

  async calculateRegionsForASubmission(
    submissionId: number,
    regionAccuracy: number = 1
  ): Promise<{ region_id: number }[]> {
    const sql = SQL`
      WITH submission_spatial_point AS (
        SELECT * 
        FROM search_spatial
        ORDER BY RANDOM() 
        LIMIT (
          SELECT CEIL(${regionAccuracy} * COUNT(*)) 
          FROM search_spatial ss, submission_feature sf 
          WHERE ss.submission_feature_id = sf.submission_feature_id 
          AND	sf.submission_id = ${submissionId})
      )
      SELECT rl.region_id
      FROM region_lookup rl 
      WHERE st_intersects(rl.geography, (
        SELECT ST_ConvexHull(st_collect(ss.value::geometry))
        FROM search_spatial ss, submission_feature sf 
        WHERE ss.submission_feature_id = sf.submission_feature_id 
        AND	sf.submission_id = ${submissionId}
      ))
      GROUP BY rl.region_name, rl.region_id;
    `;
    const response = await this.connection.sql(sql);
    return response.rows;
  }

  async insertSubmissionRegions(submissionId: number, regionIds: { region_id: number }[]) {
    // no regions, exit early
    if (!regionIds.length) {
      return;
    }
    const sql = SQL`
      INSERT INTO submission_regions (submission_id, region_id) 
      VALUES
    `;

    sql.append(
      regionIds
        .map((region) => {
          return `(${[submissionId, region.region_id].join(',  ')})`;
        })
        .join(', ')
    );

    sql.append(';');
    await this.connection.sql(sql);
  }
}
