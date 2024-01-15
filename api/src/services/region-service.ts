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
   * This function will calculate and save regions (via polygon intersect) for a given submission id.
   *
   * @param submissionId
   */
  async calculateAndAddRegionsForSubmission(submissionId: number, intersectThreshold: number = 1): Promise<void> {
    const regionIds = await this.regionRepository.calculateRegionsForASubmission(submissionId, intersectThreshold);
    console.log(regionIds);
    await this.regionRepository.insertSubmissionRegions(submissionId, regionIds);
  }
}
