import { getKnex } from '../../database/db';
import { DataRequestRecord, TeamMemberRecord, TeamPolicyRecord } from '../../models/team-authorization';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for team-scoped authorization queries.
 *
 * @export
 * @class TeamAuthorizationRepository
 * @extends {BaseRepository}
 */
export class TeamAuthorizationRepository extends BaseRepository {
  /**
   * Find an active team membership for a user in a team.
   *
   * @param {number} systemUserId
   * @param {string} teamId
   * @return {Promise<TeamMemberRecord | null>}
   * @memberof TeamAuthorizationRepository
   */
  async findTeamMembership(systemUserId: number, teamId: string): Promise<TeamMemberRecord | null> {
    const knex = getKnex();
    const query = knex('team_member as tm')
      .select('tm.team_member_id')
      .where('tm.team_id', teamId)
      .where('tm.system_user_id', systemUserId)
      .whereNull('tm.record_end_date')
      .limit(1);

    const response = await this.connection.knex(query, TeamMemberRecord);
    return response.rows[0] ?? null;
  }

  /**
   * Find an active team membership for a user through a policy.
   *
   * @param {number} systemUserId
   * @param {string} policyId
   * @return {Promise<TeamPolicyRecord | null>}
   * @memberof TeamAuthorizationRepository
   */
  async findTeamMembershipByPolicy(systemUserId: number, policyId: string): Promise<TeamPolicyRecord | null> {
    const knex = getKnex();
    const query = knex('team_policy as tp')
      .select('tp.team_policy_id')
      .join('team_member as tm', 'tm.team_id', 'tp.team_id')
      .where('tp.policy_id', policyId)
      .where('tm.system_user_id', systemUserId)
      .whereNull('tp.record_end_date')
      .whereNull('tm.record_end_date')
      .limit(1);

    const response = await this.connection.knex(query, TeamPolicyRecord);
    return response.rows[0] ?? null;
  }

  /**
   * Find an active team membership for a user through a data request.
   *
   * @param {number} systemUserId
   * @param {string} dataRequestId
   * @return {Promise<DataRequestRecord | null>}
   * @memberof TeamAuthorizationRepository
   */
  async findTeamMembershipByDataRequest(
    systemUserId: number,
    dataRequestId: string
  ): Promise<DataRequestRecord | null> {
    const knex = getKnex();
    const query = knex('data_request as dr')
      .select('dr.data_request_id')
      .join('team_member as tm', 'tm.team_id', 'dr.team_id')
      .where('dr.data_request_id', dataRequestId)
      .where('tm.system_user_id', systemUserId)
      .whereNull('dr.record_end_date')
      .whereNull('tm.record_end_date')
      .limit(1);

    const response = await this.connection.knex(query, DataRequestRecord);
    return response.rows[0] ?? null;
  }
}
