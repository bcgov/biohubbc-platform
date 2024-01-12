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
  async calculateRegionsForSubmission(submissionId: number): Promise<void> {
    const regionIds = await this.regionRepository.calculateRegionsForASubmission(submissionId);
    await this.regionRepository.insertSubmissionRegions(submissionId, regionIds);
  }
}
