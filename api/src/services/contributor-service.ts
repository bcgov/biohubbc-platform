import { IDBConnection } from '../database/db';
import { ContributorRecord } from '../models/contributor';
import { ContributorRepository } from '../repositories/contributor-repository';
import { ContributorMemberService } from './contributor-member-service';
import { DBService } from './db-service';

export class ContributorService extends DBService {
  contributorRepository: ContributorRepository;
  contributorMemberService: ContributorMemberService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorRepository = new ContributorRepository(connection);
    this.contributorMemberService = new ContributorMemberService(connection);
  }

  /**
   * Get the contributor record for a clientId
   *
   * @param {string} clientId
   * @returns {Promise<ContributorRecord>}
   */
  async getContributorByClientId(clientId: string): Promise<ContributorRecord> {
    return this.contributorRepository.getContributorByClientId(clientId);
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
    await this.contributorMemberService.ensureContributorMember(contributorId, systemUserId);

    return contributorId;
  }
}
