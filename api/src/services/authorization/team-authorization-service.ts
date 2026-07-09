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
   * - `submission_feature`: the feature is not effectively secured, or the user's team
   *   holds a security scope anchored on the feature or one of its ancestors (the same
   *   ancestry-aware check the search/download read paths apply).
   *
   * @param {number} systemUserId
   * @param {TeamAuthorizationEntity} entity
   * @return {Promise<boolean>}
   * @memberof TeamAuthorizationService
   */
  async isUserAuthorizedForTeamEntity(systemUserId: number, entity: TeamAuthorizationEntity): Promise<boolean> {
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

      case 'submission_feature':
        // Ancestry-aware access check shared with the search/download read paths: unsecured
        // features are open; secured features require the user's team to hold a scope anchored
        // on the feature or one of its ancestors.
        return this.teamAuthorizationRepository.isSubmissionFeatureAccessibleToUser(
          systemUserId,
          entity.submissionFeatureId,
          entity.submissionId
        );

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
