import { IDBConnection } from '../database/db';
import { ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import { HTTP403 } from '../errors/http-error';
import { Contributor } from '../models/contributor';
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
   * Resolve an active contributor ID and verify the caller belongs to that contributor.
   * @param clientId - Effective client ID from the request or authenticated Keycloak token.
   * @param systemUserId - Authenticated user creating the upload.
   * @returns Contributor ID authorized for submission attribution.
   * @throws {ApiValidationError} If the effective client ID is missing or invalid.
   * @throws {ApiNotFoundError} If no active contributor matches the client ID.
   * @throws {HTTP403} If the caller has no active membership in the selected contributor.
   */
  async resolveAuthorizedContributorId(clientId: string | null, systemUserId: number): Promise<number> {
    const normalizedClientId = clientId?.trim();
    if (!normalizedClientId || normalizedClientId.length > 100) {
      throw new ApiValidationError('Contributor client_id is required and must not exceed 100 characters');
    }
    const contributor = await this.contributorRepository.findContributorMembershipByClientId(
      normalizedClientId,
      systemUserId
    );
    if (!contributor) {
      throw new ApiNotFoundError('Contributor not found for client_id');
    }
    if (!contributor.is_member) {
      throw new HTTP403('Not authorized to submit for this contributor');
    }
    return contributor.contributor_id;
  }
}
