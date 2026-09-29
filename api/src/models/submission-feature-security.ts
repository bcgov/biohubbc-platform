import { z } from 'zod';
import { ApiPaginationResults } from '../zod-schema/pagination';
import { ExpressionTree } from './expression-tree';
import { NormalizedExpressionTree } from './expression-tree-internal';

export const SubmissionFeatureSecurityRecord = z.object({
  submission_feature_security_id: z.number(),
  submission_feature_id: z.number(),
  security_rule_id: z.number(),
  submission_upload_review_id: z.string().uuid().nullable(),
  submission_upload_security_id: z.number().nullable(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type SubmissionFeatureSecurityRecord = z.infer<typeof SubmissionFeatureSecurityRecord>;

export const SubmissionFeatureSecurityRule = z.object({
  security_rule_id: z.number(),
  security_category_id: z.number(),
  name: z.string(),
  category_name: z.string(),
  description: z.string().nullable(),
  provenance: z.enum(['direct', 'inherited']).nullable()
});

export type SubmissionFeatureSecurityRule = z.infer<typeof SubmissionFeatureSecurityRule>;

/** Rule rows and total count returned by an upload-scoped query. */
export const SubmissionFeatureSecurityRulesResult = z.object({
  rules: z.array(SubmissionFeatureSecurityRule),
  total: z.number()
});

export type SubmissionFeatureSecurityRulesResult = z.infer<typeof SubmissionFeatureSecurityRulesResult>;

export interface SubmissionFeatureSecurityRulesResponse {
  rules: SubmissionFeatureSecurityRule[];
  pagination: ApiPaginationResults;
}

/** Aggregate direct-assignment state for the selected upload features. */
export const SubmissionFeatureSecuritySelectedRule = SubmissionFeatureSecurityRule.omit({
  provenance: true
}).extend({ applied: z.boolean() });
export type SubmissionFeatureSecuritySelectedRule = z.infer<typeof SubmissionFeatureSecuritySelectedRule>;

export const SubmissionFeatureSecuritySelectedRulesResult = z.object({
  rules: z.array(SubmissionFeatureSecuritySelectedRule),
  total: z.number()
});
export type SubmissionFeatureSecuritySelectedRulesResult = z.infer<typeof SubmissionFeatureSecuritySelectedRulesResult>;

export interface SubmissionFeatureSecuritySelectedRulesResponse {
  rules: SubmissionFeatureSecuritySelectedRule[];
  pagination: ApiPaginationResults;
}

/** Optional feature selection and rule-name matching for upload security queries. */
export interface SubmissionFeatureSecurityRulesFilters {
  /** Nonempty IDs take precedence over expression; omitted or empty IDs use expression or whole-upload scope. */
  submissionFeatureIds?: number[];
  keyword?: string;
  expression?: ExpressionTree;
}

/** Repository query criteria: feature IDs are nonempty or omitted, and explicit IDs exclude expression scope. */
export interface NormalizedSubmissionFeatureSecurityRulesFilters {
  submissionFeatureIds?: number[];
  expression?: NormalizedExpressionTree;
  keyword?: string;
}

/** Feature selection for review mutations, with IDs taking precedence over expression. */
export interface SubmissionFeatureSecurityFeatureScope {
  submissionFeatureIds?: number[];
  expression?: ExpressionTree;
}

/** Database-ready scope: IDs are nonempty or omitted, and explicit IDs exclude expression. */
export interface NormalizedSubmissionFeatureSecurityFeatureScope {
  submissionFeatureIds?: number[];
  expression?: NormalizedExpressionTree;
}

/** Inputs for assigning rules with explicit review provenance. */
export interface InsertSubmissionFeatureSecurity {
  submissionId: number;
  submissionUploadId: string;
  featureScope: SubmissionFeatureSecurityFeatureScope;
  securityRuleIds: number[];
  submissionUploadReviewId: string;
}

/** Normalized upload scope, requested rules, and review provenance to assign. */
export interface NormalizedInsertSubmissionFeatureSecurity {
  submissionId: number;
  submissionUploadId: string;
  featureScope: NormalizedSubmissionFeatureSecurityFeatureScope;
  securityRuleIds: number[];
  submissionUploadReviewId: string;
}

/** A security rule and the optimized expression that selects the upload features it applies to. */
export interface NormalizedSecurityRuleExpression {
  securityRuleId: number;
  expression: NormalizedExpressionTree;
}

/** Upload boundary, screened rules, and the screening event recorded as provenance. */
export interface NormalizedInsertScreenedSubmissionFeatureSecurity {
  submissionId: number;
  submissionUploadId: string;
  rules: NormalizedSecurityRuleExpression[];
  submissionUploadSecurityId: number;
}

/** Distinct upload features matched by any screened rule, and the assignments the screening created or reactivated. */
export const SubmissionFeatureSecurityScreeningResult = z.object({
  matched_feature_count: z.number(),
  inserted_count: z.number()
});

export type SubmissionFeatureSecurityScreeningResult = z.infer<typeof SubmissionFeatureSecurityScreeningResult>;

/** Inputs for removing only the requested rules within an upload feature scope. */
export interface DeleteSubmissionFeatureSecurityRules {
  submissionId: number;
  submissionUploadId: string;
  featureScope: SubmissionFeatureSecurityFeatureScope;
  securityRuleIds: number[];
}

/** Normalized upload scope and requested rules to remove. */
export interface NormalizedDeleteSubmissionFeatureSecurityRules {
  submissionId: number;
  submissionUploadId: string;
  featureScope: NormalizedSubmissionFeatureSecurityFeatureScope;
  securityRuleIds: number[];
}

/** Inputs for clearing all direct assignments within an upload feature scope. */
export interface DeleteSubmissionFeatureSecurity {
  submissionId: number;
  submissionUploadId: string;
  featureScope: SubmissionFeatureSecurityFeatureScope;
}

/** Normalized upload scope for clearing direct assignments. */
export interface NormalizedDeleteSubmissionFeatureSecurity {
  submissionId: number;
  submissionUploadId: string;
  featureScope: NormalizedSubmissionFeatureSecurityFeatureScope;
}
