import { getKnex } from '../../database/db';
import { DataRequestRecord, TicketRecord } from '../../models/team-authorization';
import { BaseRepository } from '../base-repository';
import { buildSecurityFilter, isSubmissionFeatureActive } from '../sql-fragments';

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
   * Determine whether a submission feature is accessible to a user, using the same
   * ancestry-aware, closure-based check as the search/download read paths: a feature is
   * accessible when it is live (past its effective date and not ended) AND either it is not
   * effectively secured (open to authenticated and anonymous users), or the user's team holds
   * a security scope anchored on the feature or one of its ancestors.
   *
   * Reuses `buildSecurityFilter` so feature-detail authorization matches search results exactly:
   * a secured descendant of an accessible ancestor is granted, a secured feature under a parent
   * the user cannot reach is denied, and (for `systemUserId === null`) anonymous users may still
   * read unsecured features. Only features that belong to the given submission are considered.
   *
   * @param {number | null} systemUserId The authenticated user's id, or `null` for anonymous.
   * @param {number} submissionFeatureId
   * @param {number} submissionId The submission the feature must belong to.
   * @return {Promise<boolean>} `true` if the feature is accessible to the user.
   * @memberof TeamAuthorizationRepository
   */
  async isSubmissionFeatureAccessibleToUser(
    systemUserId: number | null,
    submissionFeatureId: number,
    submissionId: number
  ): Promise<boolean> {
    const knex = getKnex();
    const query = knex
      .queryBuilder()
      .select(knex.raw('1'))
      .from('submission_feature as sf')
      .where('sf.submission_feature_id', submissionFeatureId)
      .where('sf.submission_id', submissionId)
      // not-yet-effective / ended → forbidden
      .whereRaw(isSubmissionFeatureActive('sf'))
      .limit(1);

    // Pass `null` (not `undefined`) for anonymous so the unsecured-only filter is applied.
    const securityFilter = buildSecurityFilter(knex, systemUserId, 'sf.submission_feature_id');
    if (securityFilter) {
      query.whereRaw(securityFilter);
    }

    const response = await this.connection.knex(query);
    return response.rowCount === 1;
  }
}
