import { IDBConnection } from '../database/db';
import { CreateContributor, GetContributor } from '../paths/contributor/index.interface';
import { ContributorRepository } from '../repositories/contributor-repository';
import { DBService } from './db-service';

export class ContributorService extends DBService {
  contributorRepository: ContributorRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorRepository = new ContributorRepository(connection);
  }

  /**
   * Get the contributor record for a clientId
   *
   * @param {string} clientId
   * @returns {Promise<GetContributor>}
   */
  async getContributorByClientId(clientId: string): Promise<GetContributor> {
    return this.contributorRepository.getContributorByClientId(clientId);
  }

  /**
   * Adds a new contributing system and associates it with system users.
   *
   * @param {CreateContributor} contributor - The contributor data including name, description, and member system user IDs.
   * @returns {Promise<void>}
   * @memberof ContributorService
   */
  async addNewContributor(contributor: CreateContributor): Promise<void> {
    const contributorId = await this.contributorRepository.createContributor(contributor.clientId);

    const promises = contributor.members.map((member) =>
      this.contributorRepository.createContributorMember(contributorId, member.system_user_id)
    );

    await Promise.all(promises);
  }
}
