import { IDBConnection } from '../database/db';
import { ApiConflictError, ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import { AdministrativeContributor, Contributor, ContributorFilters, ContributorInput } from '../models/contributor';
import { ContributorRepository } from '../repositories/contributor-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
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
   * Get the contributor linked to a submission upload.
   *
   * @param {string} submissionUploadId
   * @returns {Promise<Contributor>}
   */
  async getContributorBySubmissionUploadId(submissionUploadId: string): Promise<Contributor> {
    return this.contributorRepository.getContributorBySubmissionUploadId(submissionUploadId);
  }

  /**
   * Get the contributor linked to a submission.
   *
   * @param {number} submissionId
   * @returns {Promise<Contributor>}
   */
  async getContributorBySubmissionId(submissionId: number): Promise<Contributor> {
    return this.contributorRepository.getContributorBySubmissionId(submissionId);
  }

  /**
   * Adds a new contributing system and associates it with system users.
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

  /**
   * List contributors and pagination metadata for administration.
   * @param filters - Contributor filters.
   * @param pagination - Bounded pagination.
   * @returns Matching contributors and pagination metadata.
   */
  async listAdministrativeContributors(filters: ContributorFilters, pagination: ApiPaginationOptions) {
    const contributors = await this.contributorRepository.listAdministrativeContributors(filters, pagination);
    const count = await this.contributorRepository.countAdministrativeContributors(filters);
    return { contributors, pagination: makePaginationResponse(count, pagination) };
  }

  /**
   * Read a contributor, including an ended contributor.
   * @param id - Contributor identifier.
   * @returns Contributor details.
   */
  async getAdministrativeContributor(id: number): Promise<AdministrativeContributor> {
    const contributor = await this.contributorRepository.getAdministrativeContributor(id);
    if (!contributor) {
      throw new ApiNotFoundError('Contributor not found');
    }
    return contributor;
  }

  /**
   * Normalize and validate editable contributor fields.
   * @param input - Submitted fields.
   * @returns Normalized fields.
   */
  private normalizeContributor(input: ContributorInput): ContributorInput {
    const clientId = input.clientId.trim();
    if (!clientId || clientId.length > 100 || (input.description !== null && input.description.length > 1000)) {
      throw new ApiValidationError(
        'Client ID is required (maximum 100 characters); description must not exceed 1000 characters'
      );
    }
    return { clientId, description: input.description };
  }

  /**
   * Create an active contributor with a unique client ID.
   * @param input - Editable fields.
   * @returns Created contributor.
   */
  async insertAdministrativeContributor(input: ContributorInput): Promise<AdministrativeContributor> {
    const normalized = this.normalizeContributor(input);
    const existing = await this.contributorRepository.findContributorByClientId(normalized.clientId);
    if (existing) {
      throw new ApiConflictError('An active contributor already uses this client ID');
    }
    const id = await this.contributorRepository.insertAdministrativeContributor(normalized);
    return this.getAdministrativeContributor(id);
  }

  /**
   * Replace editable fields of an active contributor.
   * @param id - Contributor identifier.
   * @param input - Editable fields.
   * @returns Updated contributor.
   */
  async updateAdministrativeContributor(id: number, input: ContributorInput): Promise<AdministrativeContributor> {
    const contributor = await this.getAdministrativeContributor(id);
    if (contributor.record_end_date) {
      throw new ApiConflictError('Ended contributors cannot be edited');
    }
    const normalized = this.normalizeContributor(input);
    const existing = await this.contributorRepository.findContributorByClientId(normalized.clientId);
    if (existing && existing.contributor_id !== id) {
      throw new ApiConflictError('An active contributor already uses this client ID');
    }
    await this.contributorRepository.updateAdministrativeContributor(id, normalized);
    return this.getAdministrativeContributor(id);
  }

  /**
   * End a contributor and all its active relationships in the caller's transaction.
   * @param id - Contributor identifier.
   * @returns Completion of the idempotent deletion.
   */
  async deleteAdministrativeContributor(id: number): Promise<void> {
    // Relationship writers lock this same parent before validating eligibility.
    const contributor = await this.contributorRepository.getAdministrativeContributor(id);
    if (!contributor) {
      return;
    }
    await this.contributorSystemUserService.deleteContributorSystemUsers(id);
    await this.contributorRepository.deleteAdministrativeContributor(id);
  }
}
