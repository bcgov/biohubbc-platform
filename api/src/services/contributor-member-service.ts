import { IDBConnection } from '../database/db';
import { ContributorMemberRepository } from '../repositories/contributor-member-repository';
import { DBService } from './db-service';

export class ContributorMemberService extends DBService {
  contributorMemberRepository: ContributorMemberRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorMemberRepository = new ContributorMemberRepository(connection);
  }

  /**
   * Ensure the contributor-member relationship exists.
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @returns {Promise<void>}
   */
  async ensureContributorMember(contributorId: number, systemUserId: number): Promise<void> {
    const contributorMember = await this.contributorMemberRepository.findContributorMember(contributorId, systemUserId);

    if (!contributorMember) {
      await this.contributorMemberRepository.createContributorMember(contributorId, systemUserId);
    }
  }
}
