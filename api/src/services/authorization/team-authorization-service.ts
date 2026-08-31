import { IDBConnection } from '../../database/db';
import { TeamAuthorizationRepository } from '../../repositories/authorization/team-authorization-repository';
import { DBService } from '../db-service';
import { TeamAuthorizationEntity } from './authorization-service';

/**
 * Service for resolving team-scoped authorization checks.
 *
 * @export
 * @class TeamAuthorizationService
 * @extends {DBService}
 */
export class TeamAuthorizationService extends DBService {
  teamAuthorizationRepository: TeamAuthorizationRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.teamAuthorizationRepository = new TeamAuthorizationRepository(connection);
  }

  /**
   * Check if a user is authorized for a team-scoped entity.
   *
   * Entity semantics:
   * - `ticket`: membership in the ticket visibility team.
   * - `data_request`: membership in the data-request visibility team.
   * - `submission_upload`: membership in the upload's dedicated access team.
   * - `submission`: membership in the submission's team, resolved by its explicitly named ID or UUID.
   * - `download`: UUID access for unclaimed downloads; otherwise membership in a linked download team.
   *
   * @param {number | null} systemUserId
   * @param {TeamAuthorizationEntity} entity
   * @return {Promise<boolean>}
   * @memberof TeamAuthorizationService
   */
  async isUserAuthorizedForTeamEntity(systemUserId: number | null, entity: TeamAuthorizationEntity): Promise<boolean> {
    if (entity.entity === 'download') {
      return this.teamAuthorizationRepository.isUserAuthorizedForDownload(systemUserId, entity.downloadId);
    }

    if (!systemUserId) {
      return false;
    }

    let record: { record_end_date: string | null } | null;

    switch (entity.entity) {
      case 'ticket':
        record = await this.teamAuthorizationRepository.findTeamMembershipByTicket(systemUserId, entity.ticketId);
        break;

      case 'data_request':
        record = await this.teamAuthorizationRepository.findTeamMembershipByDataRequest(
          systemUserId,
          entity.dataRequestId
        );
        break;

      case 'submission_upload':
        record = await this.teamAuthorizationRepository.findTeamMembershipBySubmissionUpload(
          systemUserId,
          entity.submissionUploadId
        );
        break;

      case 'submission':
        record =
          'submissionId' in entity
            ? await this.teamAuthorizationRepository.findTeamMembershipBySubmissionId(systemUserId, entity.submissionId)
            : await this.teamAuthorizationRepository.findTeamMembershipBySubmissionUuid(
                systemUserId,
                entity.submissionUuid
              );
        break;

      default:
        return false;
    }

    if (!record) {
      return false;
    }

    // return false if the team membership has expired
    if (record.record_end_date !== null && new Date(record.record_end_date) <= new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Determine whether a submission feature is accessible to a user, using the ancestry-aware,
   * closure-based security check shared with the search/download read paths: the feature is
   * unsecured, or the user's team holds a security scope anchored on the feature or one of its
   * ancestors.
   *
   * `systemUserId` may be `null` for anonymous users, who can still access unsecured features.
   *
   * @param {number | null} systemUserId The authenticated user's id, or `null` for anonymous.
   * @param {number} submissionFeatureId
   * @param {number} submissionId The submission the feature must belong to.
   * @return {Promise<boolean>}
   * @memberof TeamAuthorizationService
   */
  async isSubmissionFeatureAccessibleToUser(
    systemUserId: number | null,
    submissionFeatureId: number,
    submissionId: number
  ): Promise<boolean> {
    return this.teamAuthorizationRepository.isSubmissionFeatureAccessibleToUser(
      systemUserId,
      submissionFeatureId,
      submissionId
    );
  }
}
