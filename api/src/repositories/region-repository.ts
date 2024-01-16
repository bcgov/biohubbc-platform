import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { BaseRepository } from './base-repository';

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
   * Intersections are calculated based on area coverage passed in through intersectionThreshold. Area calculation done using ST_Area (https://postgis.net/docs/ST_Area.html)
   * Any regions intersecting with this calculated value are returned.
   *
   * intersectThreshold is expecting a range of values from 0.0 - 1.0.
   * A value of 0.0 means 0% of the geometries area need to intersect meaning all values from `region_lookup` will be returned.
   * A value of 1.0 means 100% of the geometries area need to be an exact match before returning a value.
   * A value of 0.3 means that 30% of the geometries area need to intersect before returning a value.
   *
   * @param {number} submissionId
   * @param {number} [intersectThreshold=1] intersectThreshold Expected 0.0 - 1.0. Determines the percentage threshold for intersections to be valid
   * @returns {*} {Promise<{region_id: number}}[]>} An array of found region ids
   * @memberof RegionRepository
   */
  async calculateRegionsForASubmission(submissionId: number, intersectThreshold = 1): Promise<{ region_id: number }[]> {
    const sql = SQL`
      SELECT rl.region_id , rl.region_name 
      FROM region_lookup rl 
      WHERE fn_calculate_area_intersect(rl.geography::geometry, (
        SELECT ST_ConvexHull(st_collect(ss.value::geometry))
        FROM search_spatial ss, submission_feature sf 
        WHERE ss.submission_feature_id = sf.submission_feature_id 
        AND sf.submission_id = ${submissionId}
      )::geometry, ${intersectThreshold})
      GROUP BY rl.region_name, rl.region_id;
    `;
    const response = await this.connection.sql(sql);
    return response.rows;
  }

  /**
   * Associates submissions with regions. This function quits early if no regions are provided.
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

    const sql = getKnex()
      .queryBuilder()
      .into('submission_regions')
      .insert(regionIds.map(({ region_id }) => ({ region_id, submission_id: submissionId })));

    await this.connection.knex(sql);
  }
}
