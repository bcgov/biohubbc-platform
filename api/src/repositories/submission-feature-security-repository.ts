import type { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import {
  NormalizedDeleteSubmissionFeatureSecurity,
  NormalizedDeleteSubmissionFeatureSecurityRules,
  NormalizedInsertSubmissionFeatureSecurity,
  NormalizedSubmissionFeatureSecurityFeatureScope,
  NormalizedSubmissionFeatureSecurityRulesFilters,
  SubmissionFeatureSecurityRecord,
  SubmissionFeatureSecurityRulesFilters,
  SubmissionFeatureSecurityRulesResult,
  SubmissionFeatureSecuritySelectedRulesResult
} from '../models/submission-feature-security';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { buildSubmissionUploadFeatureIdsSubquery } from './submission-upload-feature-search';

export class SubmissionFeatureSecurityRepository extends BaseRepository {
  /**
   * Copy current rules from each reconciliation baseline to its successor occurrence.
   *
   * Assignment provenance and expiry are preserved. Existing successor assignments and all
   * predecessor assignments are left unchanged, making this operation retry-safe.
   *
   * @param {string} submissionUploadId Pending successor upload identifier.
   * @param {string | null} predecessorSubmissionUploadId Preferred pending predecessor upload identifier.
   * @returns {Promise<void>} Resolves after copying assignments.
   * @memberof SubmissionFeatureSecurityRepository
   */
  async copySubmissionFeatureSecurityToSuccessors(
    submissionUploadId: string,
    predecessorSubmissionUploadId: string | null
  ): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature_security
        (submission_feature_id, security_rule_id, submission_upload_review_id, submission_upload_security_id, record_effective_date, record_end_date)
      SELECT
        incoming.submission_feature_id,
        predecessor_security.security_rule_id,
        predecessor_security.submission_upload_review_id,
        predecessor_security.submission_upload_security_id,
        now(),
        predecessor_security.record_end_date
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
        AND predecessor_security.record_effective_date <= now()
        AND (predecessor_security.record_end_date IS NULL OR now() < predecessor_security.record_end_date)
      ON CONFLICT (submission_feature_id, security_rule_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Gets Submission Feature Security Records for a given set of submission features
   *
   * @param {number[]} submissionFeatureIds
   * @return {*}  {Promise<SubmissionFeatureSecurityRecord[]>}
   * @memberof SubmissionFeatureSecurityRepository
   */
  async getSubmissionFeatureSecurities(submissionFeatureIds: number[]): Promise<SubmissionFeatureSecurityRecord[]> {
    const knex = getKnex();
    const queryBuilder = knex
      .queryBuilder()
      .select('*')
      .from('submission_feature_security')
      .whereIn('submission_feature_id', submissionFeatureIds)
      .where('record_effective_date', '<=', knex.fn.now())
      .where((lifecycle) => lifecycle.whereNull('record_end_date').orWhere('record_end_date', '>', knex.fn.now()));

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureSecurityRecord);

    return response.rows;
  }

  /**
   * List rules with direct assignment coverage for the selected upload features, applied rules first.
   *
   * @param {number} submissionId Submission boundary.
   * @param {string} submissionUploadId Upload boundary for every feature in scope.
   * @param {NormalizedSubmissionFeatureSecurityRulesFilters} filters Feature IDs or expression scope, plus optional rule-name matching.
   * @param {ApiPaginationOptions} pagination Requested page.
   * @returns {Promise<SubmissionFeatureSecuritySelectedRulesResult>} Rule application state and total count.
   */
  async getSubmissionFeatureSecuritySelectedRules(
    submissionId: number,
    submissionUploadId: string,
    filters: NormalizedSubmissionFeatureSecurityRulesFilters,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeatureSecuritySelectedRulesResult> {
    const featureIds = buildSubmissionUploadFeatureIdsSubquery(submissionId, submissionUploadId, filters.expression);
    if (filters.submissionFeatureIds) {
      featureIds.whereIn('anchor_sf.submission_feature_id', filters.submissionFeatureIds);
    }
    const knex = getKnex();

    const query = knex.raw(
      `
      WITH features AS (
        ?
      ), coverage AS (
        SELECT sfs.security_rule_id, count(*) AS assigned_count
        FROM features f JOIN submission_feature_security sfs USING (submission_feature_id)
        WHERE sfs.record_effective_date <= now()
          AND (sfs.record_end_date IS NULL OR now() < sfs.record_end_date)
        GROUP BY sfs.security_rule_id
      ), matches AS (
        SELECT sr.security_rule_id, sr.security_category_id, sr.name, sr.description, sc.name AS category_name,
          (SELECT count(*) FROM features) > 0
            AND COALESCE(coverage.assigned_count, 0) = (SELECT count(*) FROM features) AS applied
        FROM security_rule sr JOIN security_category sc USING (security_category_id)
        LEFT JOIN coverage ON coverage.security_rule_id = sr.security_rule_id
        WHERE sr.record_end_date IS NULL AND sc.record_end_date IS NULL AND sr.name ILIKE ?
      ), page AS (
        SELECT * FROM matches ORDER BY applied DESC, name, security_rule_id
        LIMIT ? OFFSET ?
      )
      SELECT COALESCE((SELECT jsonb_agg(page ORDER BY applied DESC, name, security_rule_id) FROM page), '[]'::jsonb) AS rules,
        (SELECT count(*)::integer FROM matches) AS total;
    `,
      [featureIds, '%' + (filters.keyword ?? '') + '%', pagination.limit, (pagination.page - 1) * pagination.limit]
    );
    const response = await this.connection.knex(query, SubmissionFeatureSecuritySelectedRulesResult);
    return response.rows[0];
  }

  /**
   * Get direct and inherited rules affecting upload features.
   * Review-time features are unpublished and absent from submission_feature_closure,
   * so ancestry follows upload-local parent_submission_feature_id links, including self.
   * Name and rule ID provide stable pagination.
   *
   * @param {string} submissionUploadId Upload boundary.
   * @param {number[]} submissionFeatureIds Explicit feature selection; empty selects nothing.
   * @param {SubmissionFeatureSecurityRulesFilters} filters Optional rule-name matching.
   * @param {ApiPaginationOptions} pagination Requested page.
   * @returns {Promise<SubmissionFeatureSecurityRulesResult>} Rule page and count.
   */
  async getSubmissionFeatureSecurityRules(
    submissionUploadId: string,
    submissionFeatureIds: number[],
    filters: SubmissionFeatureSecurityRulesFilters,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeatureSecurityRulesResult> {
    const query = SQL`
      WITH RECURSIVE features AS (
        SELECT submission_feature_id FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}::uuid AND record_end_date IS NULL
          AND submission_feature_id = ANY(${submissionFeatureIds}::integer[])
      ), ancestors AS (
        SELECT submission_feature_id AS source_id, submission_feature_id AS target_id FROM features
        UNION
        SELECT ancestors.source_id, parent.submission_feature_id
        FROM ancestors
        JOIN submission_feature child ON child.submission_feature_id = ancestors.target_id
        JOIN submission_feature parent ON parent.submission_feature_id = child.parent_submission_feature_id
          AND parent.submission_upload_id = ${submissionUploadId}::uuid AND parent.record_end_date IS NULL
      ), coverage AS (
        SELECT ancestors.source_id AS submission_feature_id, sfs.security_rule_id,
          bool_or(sfs.submission_feature_id = ancestors.source_id) AS direct
        FROM ancestors JOIN submission_feature_security sfs ON sfs.submission_feature_id = ancestors.target_id
          AND sfs.record_effective_date <= now() AND (sfs.record_end_date IS NULL OR now() < sfs.record_end_date)
        GROUP BY ancestors.source_id, sfs.security_rule_id
      ), matches AS (
        SELECT sr.security_rule_id, sr.security_category_id, sr.name, sr.description, sc.name AS category_name,
          CASE WHEN bool_or(coverage.direct) THEN 'direct' ELSE 'inherited' END AS provenance
        FROM security_rule sr JOIN security_category sc USING (security_category_id)
        LEFT JOIN coverage ON coverage.security_rule_id = sr.security_rule_id
        WHERE sr.record_end_date IS NULL AND sc.record_end_date IS NULL AND sr.name ILIKE ${
          '%' + (filters.keyword ?? '') + '%'
        }
        GROUP BY sr.security_rule_id, sc.name
        HAVING count(coverage.submission_feature_id) > 0
      ), page AS (SELECT * FROM matches ORDER BY name, security_rule_id LIMIT ${pagination.limit} OFFSET ${
      (pagination.page - 1) * pagination.limit
    })
      SELECT COALESCE((SELECT jsonb_agg(page ORDER BY name, security_rule_id) FROM page), '[]'::jsonb) AS rules,
        (SELECT count(*)::integer FROM matches) AS total;
    `;
    const response = await this.connection.sql(query, SubmissionFeatureSecurityRulesResult);
    return response.rows[0];
  }

  /**
   * Assign prevalidated rules to current upload features. Current assignments retain their provenance;
   * reactivated assignments receive the review provenance and clear legacy screening-event provenance.
   * The review orchestrator validates rule/category availability before invoking the mutation service.
   *
   * @param {NormalizedInsertSubmissionFeatureSecurity} input Normalized scope, requested rules, and required review ID.
   * @returns {Promise<void>} Resolves after inserting or reactivating assignments.
   */
  async insertSubmissionFeatureSecurity(input: NormalizedInsertSubmissionFeatureSecurity): Promise<void> {
    const knex = getKnex();
    const featureIds = this.buildSubmissionFeatureSecurityCandidateQuery(
      input.submissionId,
      input.submissionUploadId,
      input.featureScope
    );
    const query = knex.raw(
      `
      INSERT INTO submission_feature_security
        (submission_feature_id, security_rule_id, submission_upload_review_id, record_effective_date)
      SELECT DISTINCT features.submission_feature_id, rules.security_rule_id, ?::uuid, now()
      FROM (?) AS features
      CROSS JOIN unnest(?::integer[]) AS rules(security_rule_id)
      ON CONFLICT (submission_feature_id, security_rule_id)
      DO UPDATE SET record_effective_date = now(), record_end_date = NULL,
        submission_upload_review_id = EXCLUDED.submission_upload_review_id,
        submission_upload_security_id = NULL
      WHERE submission_feature_security.record_effective_date > now()
        OR submission_feature_security.record_end_date <= now()
    `,
      [input.submissionUploadReviewId, featureIds, input.securityRuleIds]
    );

    await this.connection.knex(query);
  }

  /**
   * Remove requested rules from current upload features, including assignments to ended rules/categories.
   * Empty rule IDs remove nothing.
   *
   * @param {NormalizedDeleteSubmissionFeatureSecurityRules} input Normalized scope and requested rule IDs.
   * @returns {Promise<void>} Resolves after removing matching assignments.
   */
  async deleteSubmissionFeatureSecurityRules(input: NormalizedDeleteSubmissionFeatureSecurityRules): Promise<void> {
    const knex = getKnex();
    const featureIds = this.buildSubmissionFeatureSecurityCandidateQuery(
      input.submissionId,
      input.submissionUploadId,
      input.featureScope
    );
    const query = knex('submission_feature_security')
      .whereIn('submission_feature_id', featureIds)
      .whereIn('security_rule_id', input.securityRuleIds)
      .delete();

    await this.connection.knex(query);
  }

  /**
   * Clear all direct assignments from current upload features without changing ancestor assignments outside scope.
   *
   * @param {NormalizedDeleteSubmissionFeatureSecurity} input Upload boundary and normalized feature scope.
   * @returns {Promise<void>} Resolves after removing matching assignments.
   */
  async deleteSubmissionFeatureSecurity(input: NormalizedDeleteSubmissionFeatureSecurity): Promise<void> {
    const knex = getKnex();
    const featureIds = this.buildSubmissionFeatureSecurityCandidateQuery(
      input.submissionId,
      input.submissionUploadId,
      input.featureScope
    );
    const query = knex('submission_feature_security').whereIn('submission_feature_id', featureIds).delete();

    await this.connection.knex(query);
  }

  /**
   * Build current-feature candidates within a submission/upload boundary without executing a query.
   * Expression matching retains the upload search eligibility rules; other scopes use current feature rows directly.
   *
   * @param {number} submissionId Owning submission boundary.
   * @param {string} submissionUploadId Reviewed upload boundary.
   * @param {NormalizedSubmissionFeatureSecurityFeatureScope} featureScope Database-ready feature selection.
   * @returns {Knex.QueryBuilder} Subquery selecting candidate feature IDs.
   */
  private buildSubmissionFeatureSecurityCandidateQuery(
    submissionId: number,
    submissionUploadId: string,
    featureScope: NormalizedSubmissionFeatureSecurityFeatureScope
  ): Knex.QueryBuilder {
    const knex = getKnex();
    const query = knex('submission_feature')
      .select('submission_feature_id')
      .where('submission_id', submissionId)
      .where('submission_upload_id', submissionUploadId)
      .whereNull('record_end_date');

    if (featureScope.submissionFeatureIds) {
      query.whereIn('submission_feature_id', featureScope.submissionFeatureIds);
    } else if (featureScope.expression) {
      const expressionFeatureIds = buildSubmissionUploadFeatureIdsSubquery(
        submissionId,
        submissionUploadId,
        featureScope.expression
      );
      query.whereIn('submission_feature_id', expressionFeatureIds);
    }

    return query;
  }
}
