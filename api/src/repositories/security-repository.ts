import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ArtifactPersecution, PersecutionAndHarmSecurity } from '../models/persecution-and-harm';
import { getLogger } from '../utils/logger';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/security-repository');

export enum SECURITY_APPLIED_STATUS {
  SECURED = 'SECURED',
  UNSECURED = 'UNSECURED',
  PARTIALLY_SECURED = 'PARTIALLY SECURED',
  PENDING = 'PENDING'
}

/**
 * A repository for maintaining security on artifacts.
 *
 * @export
 * @class SecurityRepository
 * @extends BaseRepository
 */
export class SecurityRepository extends BaseRepository {
  /**
   * Copy live draft and active rules from each reconciliation baseline to its successor occurrence.
   *
   * Assignment status and screening provenance are preserved. Existing successor assignments and all
   * predecessor assignments are left unchanged, making this operation retry-safe.
   *
   * @param {string} submissionUploadId Pending successor upload identifier.
   * @param {string | null} predecessorSubmissionUploadId Preferred pending predecessor upload identifier.
   * @returns {Promise<void>} Resolves after inherited assignments have been inserted.
   * @memberof SecurityRepository
   */
  async copyPredecessorSecurityRulesToSuccessors(
    submissionUploadId: string,
    predecessorSubmissionUploadId: string | null
  ): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature_security
        (submission_feature_id, security_rule_id, status, submission_upload_security_id, record_effective_date)
      SELECT
        incoming.submission_feature_id,
        predecessor_security.security_rule_id,
        predecessor_security.status,
        predecessor_security.submission_upload_security_id,
        now()
      FROM submission_feature incoming
      JOIN LATERAL (
        SELECT candidate.submission_feature_id
        FROM submission_feature candidate
        WHERE candidate.submission_id = incoming.submission_id
          AND candidate.source_id = incoming.source_id
          AND (
            candidate.submission_upload_id = ${predecessorSubmissionUploadId}::uuid
            OR (
              candidate.record_effective_date <= now()
              AND (candidate.record_end_date IS NULL OR now() < candidate.record_end_date)
              AND candidate.successor_submission_feature_id IS NULL
            )
          )
        ORDER BY
          (candidate.submission_upload_id = ${predecessorSubmissionUploadId}::uuid) DESC,
          candidate.submission_feature_id DESC
        LIMIT 1
      ) predecessor ON true
      JOIN submission_feature_security predecessor_security
        ON predecessor_security.submission_feature_id = predecessor.submission_feature_id
      WHERE incoming.submission_upload_id = ${submissionUploadId}::uuid
        AND incoming.reconciliation IS NOT NULL
        AND incoming.record_effective_date IS NULL
        AND incoming.record_end_date IS NULL
        AND predecessor_security.status IN ('draft', 'active')
        AND predecessor_security.record_effective_date <= now()
        AND (predecessor_security.record_end_date IS NULL OR now() < predecessor_security.record_end_date)
      ON CONFLICT (submission_feature_id, security_rule_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Get persecution and harm rules.
   *
   * @return {*}  {Promise<PersecutionAndHarmSecurity[]>}
   * @memberof SecurityRepository
   */
  async getPersecutionAndHarmRules(): Promise<PersecutionAndHarmSecurity[]> {
    defaultLog.debug({ label: 'getPersecutionAndHarmRules' });

    const sqlStatement = SQL`
      SELECT
        persecution_or_harm_id,
        persecution_or_harm_type_id,
        wldtaxonomic_units_id,
        name,
        description
      FROM
        persecution_or_harm;
    `;

    const response = await this.connection.sql<PersecutionAndHarmSecurity>(sqlStatement, PersecutionAndHarmSecurity);

    const results = (response.rowCount && response.rows) || null;

    if (!results) {
      throw new ApiExecuteSQLError('Failed to get persecution and harm rules');
    }

    return results;
  }

  /**
   * Get persecution and harm rules by artifact id.
   *
   * @param {number} artifactId
   * @return {*}  {Promise<ArtifactPersecution[]>}
   * @memberof SecurityRepository
   */
  async getPersecutionAndHarmRulesByArtifactId(artifactId: number): Promise<ArtifactPersecution[]> {
    defaultLog.debug({ label: 'getPersecutionAndHarmRulesByArtifactId' });

    const sqlStatement = SQL`
      SELECT
        artifact_persecution_id,
        persecution_or_harm_id,
        artifact_id
      FROM
        artifact_persecution
      WHERE
        artifact_id = ${artifactId};
    `;

    const response = await this.connection.sql<ArtifactPersecution>(sqlStatement, ArtifactPersecution);

    return response.rows;
  }

  /**
   * Apply security rules to an artifact.
   *
   * @param {number} artifactId
   * @param {number} securityId
   * @return {*}  {Promise<{ artifact_persecution_id: number }>}
   * @memberof SecurityRepository
   */
  async applySecurityRulesToArtifact(
    artifactId: number,
    securityId: number
  ): Promise<{ artifact_persecution_id: number }> {
    defaultLog.debug({ label: 'applySecurityRulesToArtifact' });

    const sqlStatement = SQL`
      INSERT INTO artifact_persecution (
        artifact_id,
        persecution_or_harm_id
      ) VALUES (
        ${artifactId},
        ${securityId}
      )
      RETURNING artifact_persecution_id;
    `;

    const response = await this.connection.sql<{ artifact_persecution_id: number }>(sqlStatement);

    const results = (response.rowCount && response.rows[0]) || null;

    if (!results) {
      throw new ApiExecuteSQLError('Failed to apply security rules to artifact');
    }

    return results;
  }

  /**
   * Remove a security rule from an artifact.
   *
   * @param {number} artifactId
   * @param {number} securityId
   * @return {*}  {Promise<void>}
   * @memberof SecurityRepository
   */
  async deleteSecurityRuleFromArtifact(artifactId: number, securityId: number): Promise<void> {
    defaultLog.debug({ label: 'deleteSecurityRuleFromArtifact' });

    const sqlStatement = SQL`
      DELETE FROM
        artifact_persecution
      WHERE
        artifact_id = ${artifactId}
        AND persecution_or_harm_id = ${securityId};
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Deletes all security rules for a given artifact UUID if they exist
   *
   * @param {string} artifactUUID
   */
  async deleteSecurityRulesForArtifactUUID(artifactUUID: string): Promise<void> {
    defaultLog.debug({ label: 'deleteSecurityRulesForArtifactUUID' });

    const sql = SQL`
      DELETE
      FROM artifact_persecution
      WHERE artifact_id IN (
        SELECT a.artifact_id
        FROM artifact a
        WHERE a.uuid = ${artifactUUID}
      );
    `;
    await this.connection.sql(sql);
  }

  /**
   * Get the persecution or harm rules for which a user is granted exception
   *
   * @param {number} userId
   * @return {*}  {Promise<{ persecution_or_harm_id: number }[]>}
   * @memberof SecurityRepository
   */
  async getPersecutionAndHarmRulesExceptionsByUserId(userId: number): Promise<{ persecution_or_harm_id: number }[]> {
    defaultLog.debug({ label: 'getPersecutionAndHarmRulesExceptionsByUserId' });

    const sqlStatement = SQL`
      SELECT
        persecution_or_harm_id
      FROM
        system_user_security_exception suse
      WHERE
        system_user_id =${userId} and end_date is null;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ persecution_or_harm_id: z.number() }));

    return (response.rowCount && response.rows) || [];
  }

  /**
   * Get the persecution and harm rules for a given artifact
   *
   * @param {number} artifactId
   * @return {*}  {Promise<{ persecution_or_harm_id: number }[]>}
   * @memberof SecurityRepository
   */
  async getDocumentPersecutionAndHarmRules(artifactId: number): Promise<{ persecution_or_harm_id: number }[]> {
    defaultLog.debug({ label: 'getDocumentPersecutionAndHarmRules' });

    const sqlStatement = SQL`
      select
        persecution_or_harm_id
      from
        artifact_persecution ap
      where
        artifact_id = ${artifactId};
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ persecution_or_harm_id: z.number() }));

    const results = (response.rowCount && response.rows) || [];

    return results;
  }

  /**
   * Insert draft `submission_feature_security` rows for every feature in `submissionUploadId`
   * that is related to one of the trigger features through `submission_feature_closure`.
   *
   * This is the automatic screening write path. Rows are inserted with `status = 'draft'` and
   * linked back to the `submission_upload_security` (scan event) that produced them, so they do
   * NOT restrict access until an admin promotes them to `status = 'active'`.
   *
   * **Closure direction:** The closure is directed `source -> target` (child -> parent/property).
   * Both directions are probed and unioned so all features meaningfully related to a trigger are
   * captured (the trigger's descendants via the reverse probe, its ancestors via the forward probe,
   * plus the self-row).
   *
   * **Idempotency:** `ON CONFLICT (submission_feature_id, security_rule_id) DO NOTHING` means
   * rerunning screening for the same upload is safe; an existing row keeps its original
   * `submission_upload_security_id` (first-scan provenance).
   *
   * @param {number[]} triggerFeatureIds `submission_feature_id` values returned by the rule's
   *   policy evaluator for the given upload.
   * @param {number} securityRuleId The security rule that identified the triggers.
   * @param {string} submissionUploadId Scope — only features from this upload are inserted.
   * @param {number} submissionUploadSecurityId The scan event that produced these rows.
   * @returns {Promise<number>} The number of draft rows inserted (conflicts excluded).
   * @memberof SecurityRepository
   */
  async insertDraftSecurityForTriggers(
    triggerFeatureIds: number[],
    securityRuleId: number,
    submissionUploadId: string,
    submissionUploadSecurityId: number
  ): Promise<number> {
    if (triggerFeatureIds.length === 0) {
      return 0;
    }

    const result = await this.connection.query<{ submission_feature_id: number }>(
      `WITH trigger_ids AS (
         SELECT unnest($1::integer[]) AS trigger_id
       ),
       related_features AS (
         -- Reverse probe: features that reach the trigger going UP (descendants + self)
         SELECT c.source_submission_feature_id AS submission_feature_id
         FROM trigger_ids tf
         JOIN submission_feature_closure c ON c.target_submission_feature_id = tf.trigger_id

         UNION

         -- Forward probe: features the trigger can reach going UP (ancestors + self)
         SELECT c.target_submission_feature_id AS submission_feature_id
         FROM trigger_ids tf
         JOIN submission_feature_closure c ON c.source_submission_feature_id = tf.trigger_id
       )
       INSERT INTO submission_feature_security
         (submission_feature_id, security_rule_id, status, submission_upload_security_id, record_effective_date)
       SELECT DISTINCT rf.submission_feature_id, $2, 'draft'::submission_feature_security_status, $4, now()
       FROM related_features rf
       JOIN submission_feature sf ON sf.submission_feature_id = rf.submission_feature_id
       WHERE sf.submission_upload_id = $3::uuid
         AND sf.record_end_date IS NULL
       ON CONFLICT (submission_feature_id, security_rule_id) DO NOTHING
       RETURNING submission_feature_id`,
      [triggerFeatureIds, securityRuleId, submissionUploadId, submissionUploadSecurityId]
    );

    return result.rowCount ?? 0;
  }
}
