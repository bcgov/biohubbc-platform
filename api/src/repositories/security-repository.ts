import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ArtifactPersecution, PersecutionAndHarmSecurity } from '../models/persecution-and-harm';
import {
  SubmissionFeatureSecurityRecord,
  SubmissionFeatureSecurityRulesSummary
} from '../models/submission-feature-security';
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
   * Attaches all of the given security rules to the given submission features.
   *
   * @param {number[]} submissionFeatureIds
   * @param {number[]} securityRuleIds
   * @return {*}  {Promise<SubmissionFeatureSecurityRecord[]>}
   * @memberof SecurityRepository
   */
  async applySecurityRulesToSubmissionFeatures(
    submissionFeatureIds: number[],
    securityRuleIds: number[]
  ): Promise<SubmissionFeatureSecurityRecord[]> {
    // Dedupe inputs — ON CONFLICT DO UPDATE errors if the same (feature, rule) pair
    // appears twice in one INSERT ("cannot affect row a second time")
    const queryValues = [...new Set(submissionFeatureIds)].flatMap((submissionFeatureId) => {
      return [...new Set(securityRuleIds)].flatMap(
        (securityRuleId) => `(${submissionFeatureId}, ${securityRuleId}, 'NOW()')`
      );
    });

    const insertSQL = SQL`
      INSERT INTO
        submission_feature_security (submission_feature_id, security_rule_id, record_effective_date) 
      VALUES `;

    insertSQL.append(queryValues.join(', '));
    // A conflicting row may be a 'draft' inserted by automatic screening — manual application
    // must promote it to 'secured' or the rule would silently remain unenforced. Rows already
    // 'secured' are left untouched (and excluded from RETURNING) to avoid audit churn.
    insertSQL.append(`
      ON CONFLICT (submission_feature_id, security_rule_id)
      DO UPDATE SET status = 'secured'
      WHERE submission_feature_security.status IS DISTINCT FROM 'secured'
      RETURNING *;`);

    const response = await this.connection.sql(insertSQL, SubmissionFeatureSecurityRecord);
    return response.rows;
  }

  /**
   * Applies all given security rules to all features of a submission.
   *
   * @param {number} submissionId
   * @param {number[]} securityRuleIds
   * @return {Promise<SubmissionFeatureSecurityRecord[]>}
   * @memberof SecurityRepository
   */
  async applySecurityToSubmission(
    submissionId: number,
    securityRuleIds: number[]
  ): Promise<SubmissionFeatureSecurityRecord[]> {
    // Dedupe — ON CONFLICT DO UPDATE errors if the same (feature, rule) pair appears
    // twice in one INSERT ("cannot affect row a second time")
    const uniqueSecurityRuleIds = [...new Set(securityRuleIds)];

    if (!uniqueSecurityRuleIds.length) {
      return [];
    }

    const placeholders = uniqueSecurityRuleIds.map((_, i) => `($${i + 1}::int)`).join(', ');
    const submissionIdPlaceholder = `$${uniqueSecurityRuleIds.length + 1}`;

    const sql = `
      INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, record_effective_date)
      SELECT sf.submission_feature_id, r.security_rule_id, NOW()
      FROM submission_feature sf
      CROSS JOIN (VALUES ${placeholders}) AS r(security_rule_id)
      WHERE sf.submission_id = ${submissionIdPlaceholder}
      ON CONFLICT (submission_feature_id, security_rule_id)
      DO UPDATE SET status = 'secured'
      WHERE submission_feature_security.status IS DISTINCT FROM 'secured'
      RETURNING *;
    `;

    const insertSQL = SQL([sql], ...uniqueSecurityRuleIds, submissionId);

    const response = await this.connection.sql(insertSQL, SubmissionFeatureSecurityRecord);
    return response.rows;
  }

  /**
   * Removes security rules from all features of a submission.
   * If no rule IDs are provided, all security rules will be removed.
   *
   * @param {number} submissionId
   * @param {number[]} [removeRuleIds]
   * @return {Promise<SubmissionFeatureSecurityRecord[]>}
   * @memberof SecurityRepository
   */
  async removeSecurityFromSubmission(
    submissionId: number,
    removeRuleIds?: number[]
  ): Promise<SubmissionFeatureSecurityRecord[]> {
    const knex = getKnex();

    const queryBuilder = knex
      .queryBuilder()
      .delete()
      .from('submission_feature_security as sfs')
      .whereIn(
        'sfs.submission_feature_id',
        knex.select('sf.submission_feature_id').from('submission_feature as sf').where('sf.submission_id', submissionId)
      )
      .returning('*');

    if (removeRuleIds?.length) {
      queryBuilder.whereIn('sfs.security_rule_id', removeRuleIds);
    }

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureSecurityRecord);
    return response.rows;
  }

  /**
   * Removes all security rules for a given set of submission features
   *
   * @param {number[]} submissionFeatureIds
   * @return {*}  {Promise<SubmissionFeatureSecurityRecord[]>}
   * @memberof SecurityRepository
   */
  async removeAllSecurityRulesFromSubmissionFeatures(
    submissionFeatureIds: number[]
  ): Promise<SubmissionFeatureSecurityRecord[]> {
    const queryBuilder = getKnex()
      .queryBuilder()
      .delete()
      .from('submission_feature_security')
      .whereIn('submission_feature_id', submissionFeatureIds)
      .returning('*');

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureSecurityRecord);

    return response.rows;
  }

  /**
   * Removes the given security rules for a given set of given submission features.
   *
   * @param {number[]} submissionFeatureIds
   * @param {number[]} removeRuleIds
   * @return {*}  {Promise<SubmissionFeatureSecurityRecord[]>}
   * @memberof SecurityRepository
   */
  async removeSecurityRulesFromSubmissionFeatures(
    submissionFeatureIds: number[],
    removeRuleIds: number[]
  ): Promise<SubmissionFeatureSecurityRecord[]> {
    defaultLog.debug({ label: 'removeSecurityRulesFromSubmissionFeatures', submissionFeatureIds, removeRuleIds });

    const queryBuilder = getKnex()
      .queryBuilder()
      .delete()
      .fromRaw('submission_feature_security sfs')
      .whereIn('sfs.submission_feature_id', submissionFeatureIds)
      .and.whereIn('sfs.security_rule_id', removeRuleIds)
      .returning('*');

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureSecurityRecord);

    return response.rows;
  }

  /**
   * Gets Submission Feature Security Records for a given set of submission features
   *
   * @param {number[]} submissionFeatureIds
   * @return {*}  {Promise<SubmissionFeatureSecurityRecord[]>}
   * @memberof SecurityRepository
   */
  async getSecurityRulesForSubmissionFeatures(
    submissionFeatureIds: number[]
  ): Promise<SubmissionFeatureSecurityRecord[]> {
    const queryBuilder = getKnex()
      .queryBuilder()
      .select('*')
      .from('submission_feature_security')
      .whereIn('submission_feature_id', submissionFeatureIds)
      // Draft rows (automatic screening output pending review) are not applied security
      .where('status', 'secured');

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureSecurityRecord);

    return response.rows;
  }
  /**
   * Get summary of rules applied to given submission.
   * If features are provided, the subset applicable to those features is returned.
   *
   * @param submissionId
   * @param submissionFeatureIds Optional array of feature IDs
   * @returns {Promise<SubmissionFeatureSecurityRulesSummary>}
   * @memberof SecurityRepository
   */
  async getSubmissionFeatureSecuritySummary(
    submissionId: number,
    submissionFeatureIds?: number[]
  ): Promise<SubmissionFeatureSecurityRulesSummary> {
    const knex = getKnex(); // your knex instance

    // Base subquery to get submission_feature_ids
    const featureIdsSubQuery = knex('submission_feature')
      .select('submission_feature_id')
      .where('submission_id', submissionId);

    // Build the main query using a CTE
    const finalQuery = knex
      .with('grouped_rules', (qb) => {
        qb.select('sfs.security_rule_id', knex.raw('COUNT(*)::int AS count'))
          .from('submission_feature_security as sfs')
          .where('sfs.status', 'secured')
          .whereIn('sfs.submission_feature_id', featureIdsSubQuery)
          .modify((qb) => {
            // Conditionally filter for specific features
            if (submissionFeatureIds && submissionFeatureIds.length > 0) {
              qb.whereIn('sfs.submission_feature_id', submissionFeatureIds);
            }
          })
          .groupBy('sfs.security_rule_id');
      })
      .select(
        knex.raw(
          `COALESCE(jsonb_agg(jsonb_build_object('security_rule_id', security_rule_id, 'count', count)), '[]'::jsonb) AS rules`
        )
      )
      .from('grouped_rules');

    const response = await this.connection.knex(finalQuery, SubmissionFeatureSecurityRulesSummary);

    return response.rows[0];
  }
}
