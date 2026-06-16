import { BaseRepository } from './base-repository';

/**
 * Repository for the automatic security screening pipeline.
 *
 * Responsible for writing draft `submission_feature_security` rows produced by
 * the automatic screening job. Manual rule application (admin PATCH) continues
 * to live in `SecurityRepository` and inserts `screened` rows directly.
 *
 * @export
 * @class AutomaticSecurityScreeningRepository
 * @extends {BaseRepository}
 */
export class AutomaticSecurityScreeningRepository extends BaseRepository {
  /**
   * Insert draft `submission_feature_security` rows for every feature in
   * `submissionUploadId` that is related to one of the trigger features through
   * `submission_feature_closure`.
   *
   * **Closure direction:** The closure is directed `source -> target`, where the
   * source is a child feature (e.g. observation) and the target is a parent or
   * property-referenced feature (e.g. sample_site). To capture all features
   * meaningfully related to a trigger both directions are probed:
   *
   * - **Reverse probe** (`target = trigger`): returns features that can reach the
   *   trigger going UP the hierarchy — i.e., the trigger's descendants. For a
   *   trigger `sample_site`, this returns the `sample_site` itself (via the
   *   self-row) and species observations that reference the `sample_site`.
   *   This is the primary direction required by AC9.
   *
   * - **Forward probe** (`source = trigger`): returns features the trigger can
   *   reach going UP — i.e., the trigger's ancestors (parent datasets, projects).
   *   Also includes the self-row for the direct match (AC8).
   *
   * The `UNION` of both directions is upload-scoped and deduped.
   *
   * **Idempotency:** `ON CONFLICT (submission_feature_id, security_rule_id) DO NOTHING`
   * means rerunning the job for the same upload is safe (AC10). The conflict target
   * references the non-partial unique constraint `submission_feature_security_uk1`
   * (`UNIQUE (submission_feature_id, security_rule_id)`), which coexists with the
   * partial unique index `_nuk1` used for soft-delete deduplication.
   *
   * **Access safety:** Draft rows have `status = 'draft'` and are excluded from
   * `isEffectivelySecured` / `computeAnchorBatch` so they do NOT restrict feature
   * access until an admin promotes them to `status = 'screened'`.
   *
   * @param {number[]} triggerFeatureIds `submission_feature_id` values returned by the
   *   rule's policy evaluator for the given upload.
   * @param {number} securityRuleId The security rule that identified the triggers.
   * @param {string} submissionUploadId Scope — only features from this upload are inserted.
   * @returns {Promise<number>} The number of draft rows inserted (conflicts excluded).
   * @memberof AutomaticSecurityScreeningRepository
   */
  async insertDraftSecurityForTriggers(
    triggerFeatureIds: number[],
    securityRuleId: number,
    submissionUploadId: string
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
         -- For a sample_site trigger: returns the sample_site itself (self-row) and
         -- observations / other children that reference the sample_site. (AC8, AC9)
         SELECT c.source_submission_feature_id AS submission_feature_id
         FROM trigger_ids tf
         JOIN submission_feature_closure c ON c.target_submission_feature_id = tf.trigger_id

         UNION

         -- Forward probe: features the trigger can reach going UP (ancestors + self)
         -- For a sample_site trigger: returns the sample_site itself (self-row) and its
         -- parent datasets / projects. (AC8)
         SELECT c.target_submission_feature_id AS submission_feature_id
         FROM trigger_ids tf
         JOIN submission_feature_closure c ON c.source_submission_feature_id = tf.trigger_id
       )
       INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, status, record_effective_date)
       SELECT DISTINCT rf.submission_feature_id, $2, 'draft'::submission_feature_security_status, now()
       FROM related_features rf
       JOIN submission_feature sf ON sf.submission_feature_id = rf.submission_feature_id
       WHERE sf.submission_upload_id = $3::uuid
         AND sf.record_end_date IS NULL
       ON CONFLICT (submission_feature_id, security_rule_id) DO NOTHING
       RETURNING submission_feature_id`,
      [triggerFeatureIds, securityRuleId, submissionUploadId]
    );

    return result.rowCount ?? 0;
  }
}
