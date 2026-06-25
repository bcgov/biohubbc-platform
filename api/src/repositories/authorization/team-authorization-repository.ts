import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { PolicyEffect } from '../../models/policy-statement';
import { DataRequestRecord, TeamPolicyRecord, TicketRecord } from '../../models/team-authorization';
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
   * Find a ticket-team membership for a user through a ticket.
   *
   * @param {number} systemUserId
   * @param {string} ticketId
   * @return {Promise<TicketRecord | null>}
   * @memberof TeamAuthorizationRepository
   */
  async findTeamMembershipByTicket(systemUserId: number, ticketId: string): Promise<TicketRecord | null> {
    const knex = getKnex();
    const query = knex
      .queryBuilder()
      .select('t.ticket_id', 'tm.record_end_date')
      .from('ticket as t')
      .join('team as team', 'team.team_id', 't.team_id')
      .join('team_member as tm', 'tm.team_id', 't.team_id')
      .where('t.ticket_id', ticketId)
      .where('tm.system_user_id', systemUserId)
      .whereNull('t.record_end_date')
      .whereNull('team.record_end_date')
      .whereNull('tm.record_end_date')
      .limit(1);

    const response = await this.connection.knex(query, TicketRecord);
    return response.rows[0] ?? null;
  }

  /**
   * Find a team membership for a user through a data request.
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
    const query = knex
      .queryBuilder()
      .select('dr.data_request_id', 'tm.record_end_date')
      .from('data_request as dr')
      .join('team as team', 'team.team_id', 'dr.team_id')
      .join('team_member as tm', 'tm.team_id', 'dr.team_id')
      .where('dr.data_request_id', dataRequestId)
      .where('tm.system_user_id', systemUserId)
      .whereNull('dr.record_end_date')
      .whereNull('team.record_end_date')
      .whereNull('tm.record_end_date')
      .limit(1);

    const response = await this.connection.knex(query, DataRequestRecord);
    return response.rows[0] ?? null;
  }

  /**
   * Find an active team policy for a user that grants access to a submission feature.
   * Uses a CTE to resolve the feature's URN parts, then joins
   * policy_statement → security_scope (URN match) → policy → team_policy → team_member.
   *
   * @param {number} systemUserId
   * @param {number} submissionFeatureId
   * @return {Promise<TeamPolicyRecord | null>}
   * @memberof TeamAuthorizationRepository
   */
  async findTeamPolicyBySubmissionFeature(
    systemUserId: number,
    submissionFeatureId: number
  ): Promise<TeamPolicyRecord | null> {
    const sql = SQL`
      WITH feature_urn_parts AS (
        SELECT
          sf.submission_feature_id,
          sf.submission_id::text AS submission_id_part,
          ft.name AS feature_type_name
        FROM submission_feature sf
        INNER JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
        WHERE sf.submission_feature_id = ${submissionFeatureId}
      )
      SELECT tp.team_policy_id, tm.record_end_date
      FROM policy_statement ps
      INNER JOIN security_scope ss
        ON ss.security_scope_id = ps.security_scope_id
      INNER JOIN feature_urn_parts f
        ON (ss.urn_submission_id = f.submission_id_part OR ss.urn_submission_id = '*')
        AND (ss.urn_feature_type = f.feature_type_name OR ss.urn_feature_type = '*')
        AND (ss.urn_feature_id = f.submission_feature_id::text OR ss.urn_feature_id = '*')
      INNER JOIN policy p
        ON p.policy_id = ps.policy_id
        AND p.record_end_date IS NULL
        AND p.status = 'approved'
      INNER JOIN team_policy tp
        ON tp.policy_id = p.policy_id
        AND tp.record_end_date IS NULL
      INNER JOIN team t
        ON t.team_id = tp.team_id
        AND t.record_end_date IS NULL
      INNER JOIN team_member tm
        ON tm.team_id = tp.team_id
        AND tm.record_end_date IS NULL
      WHERE ps.effect = ${PolicyEffect.ALLOW}
        AND ps.record_end_date IS NULL
        AND tm.system_user_id = ${systemUserId}
      LIMIT 1
    `;

    const response = await this.connection.sql(sql, TeamPolicyRecord);
    return response.rows[0] ?? null;
  }
}
