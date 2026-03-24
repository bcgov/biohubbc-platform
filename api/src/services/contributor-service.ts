import { IDBConnection } from '../database/db';
import { ContributorRepository } from '../repositories/contributor-repository';
import { ContributorSystemUserService } from './contributor-system-user-service';
import { DBService } from './db-service';

export class ContributorService extends DBService {
  contributorRepository: ContributorRepository;
  contributorSystemUserService: ContributorSystemUserService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorRepository = new ContributorRepository(connection);
    this.contributorSystemUserService = new ContributorSystemUserService(connection);
  }

  /**
   * Ensure contributor exists.
   *
   * @param {string} clientId
   * @returns {Promise<number>}
   */
  async ensureContributor(clientId: string): Promise<number> {
    const contributor = await this.contributorRepository.findContributorByClientId(clientId);

    if (contributor) {
      return contributor.contributor_id;
    }

    return this.contributorRepository.createContributor(clientId);
  }

  /**
   * Ensure contributor exists and ensure relationship with a system user.
   *
   * @param {string} clientId
   * @param {number} systemUserId
   * @returns {Promise<number>}
   */
  async ensureContributorForSystemUser(clientId: string, systemUserId: number): Promise<number> {
    const contributorId = await this.ensureContributor(clientId);
    await this.contributorSystemUserService.ensureContributorSystemUser(contributorId, systemUserId);

    return contributorId;
  }
}
