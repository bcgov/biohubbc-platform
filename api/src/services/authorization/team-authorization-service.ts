import { IDBConnection } from '../../database/db';
import { TeamAuthorizationRepository } from '../../repositories/authorization/team-authorization-repository';
import { DBService } from '../db-service';
import { SubmissionService } from '../submission-service';
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
   * @param {number} systemUserId
   * @param {TeamAuthorizationEntity} entity
   * @return {Promise<boolean>}
   * @memberof TeamAuthorizationService
   */
  async isUserAuthorizedForTeamEntity(systemUserId: number, entity: TeamAuthorizationEntity): Promise<boolean> {
    let record: { record_end_date: string | null } | null;

    switch (entity.entity) {
      case 'data_request':
        record = await this.teamAuthorizationRepository.findTeamMembershipByDataRequest(
          systemUserId,
          entity.dataRequestId
        );
        break;

      case 'submission_feature': {
        const submissionService = new SubmissionService(this.connection);
        const feature = await submissionService.getSubmissionFeatureById(entity.submissionFeatureId);

        if (!feature.secured) {
          return true;
        }

        if (
          entity.submissionId !== undefined &&
          entity.submissionId !== null &&
          feature.submission_id !== entity.submissionId
        ) {
          return false;
        }

        record = await this.teamAuthorizationRepository.findTeamPolicyBySubmissionFeature(
          systemUserId,
          entity.submissionFeatureId
        );
        break;
      }

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
