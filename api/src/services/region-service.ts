import { IDBConnection } from '../database/db';
import { RegionRepository } from '../repositories/region-repository';
import { DBService } from './db-service';

export class RegionService extends DBService {
  regionRepository: RegionRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.regionRepository = new RegionRepository(connection);
  }

  /**
   * Calculates region intersects for a submission search_spatial data.
   * Submission spatial data is collected then converted into a single polygon using ST_ConvexHull (https://postgis.net/docs/ST_ConvexHull.html)
   * Intersections are calculated based on area coverage passed in through intersectionThreshold. Area calculation done using ST_Area (https://postgis.net/docs/ST_Area.html)
   * Any regions intersecting with this calculated value are then associated with the given submission.
   *
   * intersectThreshold is expecting a range of values from 0.0 - 1.0.
   * A value of 0.0 means 0% of the geometries area need to intersect meaning all values from `region_lookup` will be returned.
   * A value of 1.0 means 100% of the geometries area need to be an exact match before returning a value.
   * A value of 0.3 means that 30% of the geometries area need to intersect before returning a value.
   *
   * @param {number} submissionId
   * @param {number} [intersectThreshold=1] intersectThreshold Expected 0.0 - 1.0. Determines the percentage threshold for intersections to be valid
   * @memberof RegionService
   */
  async calculateAndAddRegionsForSubmission(submissionId: number, intersectThreshold = 1): Promise<void> {
    const regionIds = await this.regionRepository.calculateRegionsForASubmission(submissionId, intersectThreshold);
    await this.regionRepository.insertSubmissionRegions(submissionId, regionIds);
  }
}
