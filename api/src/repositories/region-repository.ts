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
  /**
   * Fetches all region records.
   *
   * @returns {*} {Promise<RegionRecord[]>} An array of Region Records
   * @memberof RegionRepository
   */
  async getRegions(): Promise<RegionRecord[]> {
    const sql = SQL`
      SELECT * FROM region_lookup
    `;
    const response = await this.connection.sql(sql, RegionRecord);
    return response.rows;
  }

  /**
   * Calculates region intersects for a submission search_spatial data.
   * Submission spatial data is collected then converted into a single polygon using ST_ConvexHull (https://postgis.net/docs/ST_ConvexHull.html)
   * Any regions intersecting with this calculated value are returned.
   *
   * @param {number} submissionId
   * @param {number} [regionAccuracy=1] regionAccuracy Expected 0-1. Determines the percentage of rows to use
   * @returns {*} {Promise<{region_id: number}}[]>} An array of found region ids
   * @memberof RegionRepository
   */
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

  /**
   * Associates submissions with regions
   *
   * @param {number} submissionId
   * @param {number[]} regionIds
   * @memberof RegionRepository
   */
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
