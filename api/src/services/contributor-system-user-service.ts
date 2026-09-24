import { IDBConnection } from '../database/db';
import { ApiConflictError, ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import {
  AdministrativeContributorSystemUser,
  ContributorSystemUser,
  ContributorSystemUserFilters,
  ContributorSystemUserInput
} from '../models/contributor-system-user';
import { ContributorRepository } from '../repositories/contributor-repository';
import { ContributorSystemUserRepository } from '../repositories/contributor-system-user-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

export class ContributorSystemUserService extends DBService {
  contributorRepository: ContributorRepository;
  contributorSystemUserRepository: ContributorSystemUserRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.contributorRepository = new ContributorRepository(connection);
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

  /**
   * List relationships with related labels and pagination metadata.
   * @param filters - Relationship filters.
   * @param pagination - Bounded pagination.
   * @returns Matching relationships and pagination metadata.
   */
  async listAdministrativeContributorSystemUsers(
    filters: ContributorSystemUserFilters,
    pagination: ApiPaginationOptions
  ) {
    const contributor_users = await this.contributorSystemUserRepository.listAdministrativeContributorSystemUsers(
      filters,
      pagination
    );
    const count = await this.contributorSystemUserRepository.countAdministrativeContributorSystemUsers(filters);
    return { contributor_users, pagination: makePaginationResponse(count, pagination) };
  }

  /**
   * Read a relationship, including ended relationships.
   * @param id - Relationship identifier.
   * @returns Relationship details.
   */
  async getAdministrativeContributorSystemUser(id: number): Promise<AdministrativeContributorSystemUser> {
    const relationship = await this.contributorSystemUserRepository.getAdministrativeContributorSystemUser(id);
    if (!relationship) {
      throw new ApiNotFoundError('Contributor user not found');
    }
    return relationship;
  }

  /**
   * Lock selected parents and ensure they can receive an active assignment.
   * @param input - Selected contributor and system user.
   * @returns Completion when both selections are eligible.
   */
  private async validateContributorSystemUser(input: ContributorSystemUserInput): Promise<void> {
    const contributor = await this.contributorRepository.getAdministrativeContributor(input.contributorId);
    if (!contributor || contributor.record_end_date) {
      throw new ApiValidationError('Select an active contributor');
    }
    const activeUser = await this.contributorSystemUserRepository.lockActiveSystemUser(input.systemUserId);
    if (!activeUser) {
      throw new ApiValidationError('Select an active system user');
    }
  }

  /**
   * Create a relationship for an unassigned active user.
   * @param input - Selected contributor and user.
   * @returns Created relationship.
   */
  async insertAdministrativeContributorSystemUser(
    input: ContributorSystemUserInput
  ): Promise<AdministrativeContributorSystemUser> {
    await this.validateContributorSystemUser(input);
    const existing = await this.findContributorSystemUser(input.systemUserId);
    if (existing) {
      throw new ApiConflictError('This system user already has an active contributor relationship');
    }
    const id = await this.contributorSystemUserRepository.insertAdministrativeContributorSystemUser(input);
    return this.getAdministrativeContributorSystemUser(id);
  }

  /**
   * End a relationship without changing its historical attribution.
   * @param id - Relationship identifier.
   * @returns Completion of the idempotent deletion.
   */
  async deleteAdministrativeContributorSystemUser(id: number): Promise<void> {
    await this.contributorSystemUserRepository.deleteAdministrativeContributorSystemUser(id);
  }

  /**
   * End the relationships of a contributor already locked by the caller.
   * @param contributorId - Contributor being deleted.
   * @returns Completion without loading affected rows.
   */
  async deleteContributorSystemUsers(contributorId: number): Promise<void> {
    await this.contributorSystemUserRepository.deleteContributorSystemUsers(contributorId);
  }
}
