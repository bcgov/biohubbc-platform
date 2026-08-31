import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import {
  DataRequestRecord,
  SubmissionRecord,
  SubmissionUploadRecord,
  TeamAuthorizationResult,
  TicketRecord
} from '../../models/team-authorization';
import { BaseRepository } from '../base-repository';
import {
  buildSecurityFilter,
  buildSubmissionFeatureTerminalSubquery,
  isSubmissionFeatureCurrent,
  isSubmissionFeaturePublished
} from '../sql-fragments';

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
   * Find a team membership for a user through a submission upload.
   *
   * @param {number} systemUserId
   * @param {string} submissionUploadId
   * @return {Promise<SubmissionUploadRecord | null>}
   * @memberof TeamAuthorizationRepository
   */
  async findTeamMembershipBySubmissionUpload(
    systemUserId: number,
    submissionUploadId: string
  ): Promise<SubmissionUploadRecord | null> {
    const knex = getKnex();
    const query = knex
      .queryBuilder()
      .select('su.submission_upload_id', 'tm.record_end_date')
      .from('submission_upload as su')
      .join('team as team', 'team.team_id', 'su.team_id')
      .join('team_member as tm', 'tm.team_id', 'su.team_id')
      .where('su.submission_upload_id', submissionUploadId)
      .where('tm.system_user_id', systemUserId)
      .whereNull('su.record_end_date')
      .whereNull('team.record_end_date')
      .whereNull('tm.record_end_date')
      .limit(1);

    const response = await this.connection.knex(query, SubmissionUploadRecord);
    return response.rows[0] ?? null;
  }

  /**
   * Find a team membership for a user through a submission.
   *
   * @param {number} systemUserId
   * @param {number} submissionId Submission database ID.
   * @return {Promise<SubmissionRecord | null>}
   * @memberof TeamAuthorizationRepository
   */
  async findTeamMembershipBySubmissionId(systemUserId: number, submissionId: number): Promise<SubmissionRecord | null> {
    const knex = getKnex();
    const query = knex
      .queryBuilder()
      .select('s.submission_id', 'tm.record_end_date')
      .from('submission as s')
      .join('team as team', 'team.team_id', 's.team_id')
      .join('team_member as tm', 'tm.team_id', 's.team_id')
      .where('s.submission_id', submissionId)
      .where('tm.system_user_id', systemUserId)
      .whereNull('s.record_end_date')
      .whereNull('team.record_end_date')
      .whereNull('tm.record_end_date')
      .limit(1);

    const response = await this.connection.knex(query, SubmissionRecord);
    return response.rows[0] ?? null;
  }

  /**
   * Find a team membership for a user through a submission UUID.
   *
   * @param {number} systemUserId
   * @param {string} submissionUuid Submission UUID.
   * @return {Promise<SubmissionRecord | null>}
   * @memberof TeamAuthorizationRepository
   */
  async findTeamMembershipBySubmissionUuid(
    systemUserId: number,
    submissionUuid: string
  ): Promise<SubmissionRecord | null> {
    const knex = getKnex();
    const query = knex
      .queryBuilder()
      .select('s.submission_id', 'tm.record_end_date')
      .from('submission as s')
      .join('team as team', 'team.team_id', 's.team_id')
      .join('team_member as tm', 'tm.team_id', 's.team_id')
      .where('s.uuid', submissionUuid)
      .where('tm.system_user_id', systemUserId)
      .whereNull('s.record_end_date')
      .whereNull('team.record_end_date')
      .whereNull('tm.record_end_date')
      .limit(1);

    const response = await this.connection.knex(query, SubmissionRecord);
    return response.rows[0] ?? null;
  }

  /**
   * Check whether a user can access a download through its team association.
   *
   * Unclaimed downloads have no active `download_team` rows and are authorized by UUID.
   * Claimed downloads require an authenticated user with active membership in a linked team.
   *
   * @param {number | null} systemUserId
   * @param {string} downloadId
   * @return {Promise<boolean>}
   * @memberof TeamAuthorizationRepository
   */
  async isUserAuthorizedForDownload(systemUserId: number | null, downloadId: string): Promise<boolean> {
    const sql = SQL`
      SELECT EXISTS (
        SELECT 1
        FROM download d
        WHERE d.download_id = ${downloadId}
          AND (
            NOT EXISTS (
              SELECT 1
              FROM download_team dt
              WHERE dt.download_id = d.download_id
                AND dt.record_end_date IS NULL
            )
            OR (
              ${systemUserId}::integer IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM download_team dt
                JOIN team t ON t.team_id = dt.team_id
                JOIN team_member tm ON tm.team_id = dt.team_id
                WHERE dt.download_id = d.download_id
                  AND tm.system_user_id = ${systemUserId}
                  AND dt.record_end_date IS NULL
                  AND t.record_end_date IS NULL
                  AND tm.record_end_date IS NULL
              )
            )
          )
      ) AS authorized;
    `;

    const response = await this.connection.sql(sql, TeamAuthorizationResult);

    return response.rows[0]?.authorized ?? false;
  }

  /**
   * Determine whether a published feature is accessible to a caller.
   *
   * Superseded features remain accessible by direct ID when the caller passes the same current-security
   * rules used for current features. Current features use the materialized closure. Because that closure
   * contains only current features, authorization for a superseded feature reconstructs its immutable stored
   * parent ancestry. The relationship graph is the only historical input: security assignments, team membership,
   * and scope entitlement are always evaluated as they exist now. The caller must satisfy authorization over
   * that ancestry and the ordinary authorization context of the terminal current feature.
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
    const terminalFeatureId = 'terminal.terminal_submission_feature_id';
    const query = knex
      .queryBuilder()
      .select(knex.raw('1'))
      .from('submission_feature as sf')
      .where('sf.submission_feature_id', submissionFeatureId)
      .where('sf.submission_id', submissionId)
      .whereRaw(isSubmissionFeaturePublished('sf'))
      .joinRaw(`JOIN LATERAL ${buildSubmissionFeatureTerminalSubquery('sf.submission_feature_id')} terminal ON true`)
      .limit(1);

    // Every feature, current or superseded, must pass the terminal current feature's ordinary
    // closure-backed authorization. Supersession alone therefore does not revoke direct-ID access,
    // but a current security change can. Pass null (not undefined) for anonymous callers.
    const currentSecurityFilter = buildSecurityFilter(knex, systemUserId, terminalFeatureId);
    if (currentSecurityFilter) {
      query.whereRaw(currentSecurityFilter);
    }

    query.where((lifecycle) => {
      lifecycle.whereRaw(isSubmissionFeatureCurrent('sf')).orWhere((historical) => {
        historical
          .whereRaw(`NOT (${isSubmissionFeatureCurrent('sf')})`)
          .whereRaw(this.buildSupersededFeatureSecurityFilter(knex, systemUserId));
      });
    });

    const response = await this.connection.knex(query);
    return response.rowCount === 1;
  }

  /**
   * Build the point-read authorization predicate for a superseded feature.
   *
   * Performs recursive parent traversal for one explicitly requested superseded feature. Bulk and current
   * feature reads must use `submission_feature_closure`; this predicate must never be applied per candidate.
   *
   * The only historical input is the immutable parent chain. Security assignments, scope entitlement,
   * team state, and membership are all evaluated as they exist now. This deliberately avoids the current-graph
   * closure and anchor caches: the small parent chain is reconstructed directly, then matched against reusable
   * security_scope and team_security_scope rows. Parent traversal is same-submission and cycle-safe and never
   * projects ancestors through successors.
   *
   * @param knex Knex instance used to bind the current system user id.
   * @param systemUserId Current caller id, or null for anonymous.
   * @returns Superseded-feature security predicate correlated to the outer `sf` feature row.
   */
  private buildSupersededFeatureSecurityFilter(knex: Knex, systemUserId: number | null): Knex.Raw {
    const historicalAncestry = `WITH RECURSIVE historical_ancestry AS (
      SELECT
        historical.submission_feature_id,
        historical.submission_id,
        historical.feature_type_id,
        historical.parent_submission_feature_id,
        0 AS depth,
        ARRAY[historical.submission_feature_id]::integer[] AS path
      FROM submission_feature historical
      WHERE historical.submission_feature_id = sf.submission_feature_id
        AND NOT (${isSubmissionFeatureCurrent('sf')})

      UNION ALL

      SELECT
        parent.submission_feature_id,
        parent.submission_id,
        parent.feature_type_id,
        parent.parent_submission_feature_id,
        child.depth + 1,
        child.path || parent.submission_feature_id
      FROM historical_ancestry child
      JOIN submission_feature parent
        ON parent.submission_feature_id = child.parent_submission_feature_id
       AND parent.submission_id = child.submission_id
      WHERE NOT parent.submission_feature_id = ANY(child.path)
    )`;

    const enforcingSecurity = `(sfs.status = 'active'
      AND sfs.record_effective_date <= now()
      AND (sfs.record_end_date IS NULL OR now() < sfs.record_end_date))`;

    const historicallyUnsecured = `NOT EXISTS (
      SELECT 1
      FROM historical_ancestry secured_feature
      JOIN submission_feature_security sfs
        ON sfs.submission_feature_id = secured_feature.submission_feature_id
      WHERE ${enforcingSecurity}
    )`;

    if (!systemUserId) {
      return knex.raw(`EXISTS (${historicalAncestry} SELECT 1 WHERE ${historicallyUnsecured})`);
    }

    return knex.raw(
      `EXISTS (
        ${historicalAncestry}
        SELECT 1
        WHERE ${historicallyUnsecured}
           OR EXISTS (
             SELECT 1
             FROM historical_ancestry candidate
             JOIN feature_type ft ON ft.feature_type_id = candidate.feature_type_id
             JOIN security_scope ss
               ON (ss.urn_submission_id = candidate.submission_id::text OR ss.urn_submission_id = '*')
              AND (ss.urn_feature_type = ft.name OR ss.urn_feature_type = '*')
              AND (ss.urn_feature_id = candidate.submission_feature_id::text OR ss.urn_feature_id = '*')
             JOIN team_security_scope tss ON tss.security_scope_id = ss.security_scope_id
             JOIN team t ON t.team_id = tss.team_id AND t.record_end_date IS NULL
             JOIN team_member tm
               ON tm.team_id = tss.team_id
              AND tm.system_user_id = ?
              AND tm.record_end_date IS NULL
             WHERE EXISTS (
               SELECT 1
               FROM historical_ancestry secured_ancestor
               JOIN submission_feature_security sfs
                 ON sfs.submission_feature_id = secured_ancestor.submission_feature_id
               WHERE secured_ancestor.depth >= candidate.depth
                 AND ${enforcingSecurity}
             )
           )
      )`,
      [systemUserId]
    );
  }
}
