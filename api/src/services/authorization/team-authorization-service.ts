import { IDBConnection } from '../../database/db';
import { TeamAuthorizationRepository } from '../../repositories/authorization/team-authorization-repository';
import { PolicyService } from '../access-policy/policy-service';
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
    switch (entity.entity) {
      case 'team': {
        const record = await this.teamAuthorizationRepository.findTeamMembership(systemUserId, entity.teamId);
        return record !== null;
      }

      case 'policy': {
        const record = await this.teamAuthorizationRepository.findTeamMembershipByPolicy(systemUserId, entity.policyId);
        return record !== null;
      }

      case 'data_request': {
        const record = await this.teamAuthorizationRepository.findTeamMembershipByDataRequest(
          systemUserId,
          entity.dataRequestId
        );
        return record !== null;
      }

      case 'submission_feature': {
        const submissionService = new SubmissionService(this.connection);
        const feature = await submissionService.getSubmissionFeatureById(entity.submissionFeatureId);

        if (!feature.secured) {
          return true;
        }

        if (entity.submissionId !== undefined && feature.submission_id !== entity.submissionId) {
          return false;
        }

        const policyService = new PolicyService(this.connection);
        const policiesThatGrantAccess = await policyService.getPoliciesThatAuthorizeFeatureAccessByUrn(
          feature.urn,
          systemUserId
        );

        return policiesThatGrantAccess.length > 0;
      }
    }

    return false;
  }
}
