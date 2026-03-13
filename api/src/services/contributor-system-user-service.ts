import { IDBConnection } from '../database/db';
import { ContributorSystemUser } from '../models/contributor-system-user';
import { ContributorSystemUserRepository } from '../repositories/contributor-system-user-repository';
import { DBService } from './db-service';

export class ContributorSystemUserService extends DBService {
  contributorSystemUserRepository: ContributorSystemUserRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorSystemUserRepository = new ContributorSystemUserRepository(connection);
  }

  /**
   * Ensure the contributor-system-user relationship exists.
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @returns {Promise<void>}
   */
  async ensureContributorSystemUser(contributorId: number, systemUserId: number): Promise<void> {
    const contributorSystemUser = await this.contributorSystemUserRepository.findContributorSystemUser(systemUserId);

    if (!contributorSystemUser) {
      await this.contributorSystemUserRepository.createContributorSystemUser(contributorId, systemUserId);
    }
  }

  /**
   * Find the active contributor-system-user relationship for a system user.
   *
   * @param {number} systemUserId
   * @returns {Promise<ContributorSystemUser | null>}
   */
  async findContributorSystemUser(systemUserId: number): Promise<ContributorSystemUser | null> {
    return this.contributorSystemUserRepository.findContributorSystemUser(systemUserId);
  }
}
