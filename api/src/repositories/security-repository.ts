import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { getLogger } from '../utils/logger';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/security-repository');

export const PersecutionAndHarmSecurity = z.object({
  persecution_or_harm_id: z.number(),
  persecution_or_harm_type_id: z.number(),
  wldtaxonomic_units_id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional()
});

export type PersecutionAndHarmSecurity = z.infer<typeof PersecutionAndHarmSecurity>;

export const SecurityRuleRecord = z.object({
  security_rule_id: z.number(),
  name: z.string(),
  description: z.string(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});
export type SecurityRuleRecord = z.infer<typeof SecurityRuleRecord>;

export const SecurityCategoryRecord = z.object({
  security_category_id: z.number(),
  name: z.string(),
  description: z.string(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});
export type SecurityCategoryRecord = z.infer<typeof SecurityCategoryRecord>;

export const SecurityRuleAndCategory = z.object({
  security_rule_id: z.number(),
  name: z.string(),
  description: z.string(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  security_category_id: z.number(),
  category_name: z.string(),
  category_description: z.string(),
  category_record_effective_date: z.string(),
  category_record_end_date: z.string().nullable()
});
export type SecurityRuleAndCategory = z.infer<typeof SecurityRuleAndCategory>;

export const SubmissionFeatureSecurityRecord = z.object({
  submission_feature_security_id: z.number(),
  submission_feature_id: z.number(),
  security_rule_id: z.number(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});
export type SubmissionFeatureSecurityRecord = z.infer<typeof SubmissionFeatureSecurityRecord>;

export const SecurityReason = z.object({
  id: z.number(),
  type_id: z.number()
});
export type SecurityReason = z.infer<typeof SecurityReason>;

export const ArtifactPersecution = z.object({
  artifact_persecution_id: z.number(),
  persecution_or_harm_id: z.number(),
  artifact_id: z.number()
});

export type ArtifactPersecution = z.infer<typeof ArtifactPersecution>;

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
   * Get all active security categories. A security category is active if it has not been
   * end-dated.
   *
   * @return {*}  {Promise<SecurityCategoryRecord[]>}
   * @memberof SecurityRepository
   */
  async getActiveSecurityCategories(): Promise<SecurityCategoryRecord[]> {
    defaultLog.debug({ label: 'getActiveSecurityCategories' });
    const sql = SQL`
      SELECT * FROM security_category WHERE record_end_date IS NULL;
    `;
    const response = await this.connection.sql(sql, SecurityCategoryRecord);
    return response.rows;
  }

  /**
   * Gets a list of all active security rules with associated categories. A security rule is
   * active if it has not been end-dated.
   *
   * @return {*}  {Promise<SecurityRuleAndCategory[]>}
   * @memberof SecurityRepository
   */
  async getActiveRulesAndCategories(): Promise<SecurityRuleAndCategory[]> {
    defaultLog.debug({ label: 'getActiveRulesAndCategories' });
    const sql = SQL`
      SELECT 
        sr.security_rule_id,
        sr.name,
        sr.description,
        sr.record_effective_date,
        sr.record_end_date,
        sc.security_category_id,
        sc.name as category_name,
        sc.description as category_description,
        sc.record_effective_date as category_record_effective_date,
        sc.record_end_date as category_record_end_date
      FROM security_rule sr, security_category sc 
      WHERE sr.security_category_id = sc.security_category_id
      AND sr.record_end_date IS NULL;
    `;
    const response = await this.connection.sql(sql, SecurityRuleAndCategory);
    return response.rows;
  }

  /**
   * Gets a list of all active security rules. A security rule is active if it has not
   * been end-dated.
   *
   * @return {*}  {Promise<SecurityRuleRecord[]>}
   * @memberof SecurityRepository
   */
  async getActiveSecurityRules(): Promise<SecurityRuleRecord[]> {
    defaultLog.debug({ label: 'getActiveSecurityRules' });
    const sql = SQL`
      SELECT * FROM security_rule WHERE record_end_date IS NULL;
    `;
    const response = await this.connection.sql(sql, SecurityRuleRecord);
    return response.rows;
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
    defaultLog.debug({ label: 'applySecurityRulesToSubmissionFeatures', submissionFeatureIds, securityRuleIds });

    const queryValues = submissionFeatureIds.flatMap((submissionFeatureId) => {
      return securityRuleIds.flatMap((securityRuleId) => `(${submissionFeatureId}, ${securityRuleId}, 'NOW()')`);
    });

    const insertSQL = SQL`
      INSERT INTO
        submission_feature_security (submission_feature_id, security_rule_id, record_effective_date) 
      VALUES `;

    insertSQL.append(queryValues.join(', '));
    insertSQL.append(`
      ON CONFLICT (submission_feature_id, security_rule_id)
      DO NOTHING
      RETURNING *;`);

    const response = await this.connection.sql(insertSQL, SubmissionFeatureSecurityRecord);
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
      .whereIn('submission_feature_id', submissionFeatureIds);

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureSecurityRecord);

    return response.rows;
  }

  /**
   * Gets Submission Feature Security Records for a given set of submission features
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionFeatureSecurityRecord[]>}
   * @memberof SecurityRepository
   */
  async getAllSecurityRulesForSubmission(submissionId: number): Promise<SubmissionFeatureSecurityRecord[]> {
    const queryBuilder = getKnex()
      .select('*')
      .from('submission_feature_security')
      .whereIn('submission_feature_id', (subQuery) => {
        return subQuery.select('submission_feature_id').from('submission_feature').where('submission_id', submissionId);
      });

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureSecurityRecord);

    return response.rows;
  }
}
