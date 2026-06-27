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
   * - `submission_feature`: ancestry-aware, closure-based access shared with the search/download
   *   read paths — the feature is unsecured, or the user's team holds a security scope anchored
   *   on the feature or one of its ancestors. `systemUserId` may be `null` for anonymous users
   *   (who can still access unsecured features).
   *
   * @param {number | null} systemUserId The authenticated user's id, or `null` for anonymous.
   * @param {TeamAuthorizationEntity} entity
   * @return {Promise<boolean>}
   * @memberof TeamAuthorizationService
   */
  async isUserAuthorizedForTeamEntity(systemUserId: number | null, entity: TeamAuthorizationEntity): Promise<boolean> {
    // submission_feature uses closure-based access and supports anonymous (unsecured) access.
    if (entity.entity === 'submission_feature') {
      return this.teamAuthorizationRepository.isSubmissionFeatureAccessibleToUser(
        systemUserId,
        entity.submissionFeatureId,
        entity.submissionId
      );
    }

    // ticket / data_request require an authenticated user.
    if (systemUserId === null) {
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
}
