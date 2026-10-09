import { IFeatureProperty } from './useFeaturePropertiesApi.interface';
import { ExpressionTreeExpression } from './expression.interface';
import { ApiCursorResponseParams, ApiPaginationResponseParams } from 'types/pagination';

export interface IgcNotifyGenericMessage {
  subject: string;
  header: string;
  body1: string;
  body2: string;
  footer: string;
}

export interface IgcNotifyRecipient {
  emailAddress: string;
  phoneNumber: string;
  userId: number;
}

export interface IGetRoles {
  system_role_id: number;
  name: string;
}

export interface ISubmissionUploadReviewDetail {
  submission_upload_review_id: string;
  submission_upload_id: string;
  name: string;
  description: string | null;
  scope: 'validation' | 'security';
  status: 'pending' | 'requested' | 'in_progress' | 'completed' | 'blocked' | 'skipped' | 'cancelled';
  requested_by: number | null;
}

export interface ISubmissionUploadReconciliationCounts {
  new: number;
  modified: number;
  unmodified: number;
}

export type SubmissionUploadReviewSecurityProvenance = 'direct' | 'inherited';

export interface ISubmissionUploadReviewSecurityFeature {
  submission_feature_id: number;
  feature_type_id: number;
  feature_type_name: string;
  provenance: SubmissionUploadReviewSecurityProvenance | null;
}

export interface ISubmissionUploadSecuritySearchFeature extends ISubmissionUploadReviewSecurityFeature {
  parent_submission_feature_id: number | null;
  create_date: string;
}

export interface ISubmissionUploadReviewSecurityFeatureResponse {
  features: ISubmissionUploadSecuritySearchFeature[];
  pagination: ApiCursorResponseParams;
}

export interface ISubmissionUploadReviewSecurityFeatureCountResponse {
  total: number;
}

export interface ISubmissionUploadReviewSecurityRule {
  security_rule_id: number;
  security_category_id: number;
  name: string;
  category_name: string;
}

export interface ISubmissionUploadReviewSelectedFeatureRule extends ISubmissionUploadReviewSecurityRule {
  applied: boolean;
}

export interface ISubmissionUploadReviewSelectedFeatureRuleResponse {
  rules: ISubmissionUploadReviewSelectedFeatureRule[];
  pagination: ApiPaginationResponseParams;
}

export interface ISubmissionUploadReviewFeatureRule extends ISubmissionUploadReviewSecurityRule {
  description: string | null;
  provenance: SubmissionUploadReviewSecurityProvenance;
}

export interface ISubmissionUploadReviewFeatureRuleResponse {
  rules: ISubmissionUploadReviewFeatureRule[];
  pagination: ApiPaginationResponseParams;
}

export interface SubmissionFeatureSecurityRulesFilters {
  keyword?: string;
  expression?: ExpressionTreeExpression;
}

/** Spatial extent of one current feature within an upload. */
export interface ISubmissionUploadFeatureGeometryExtent {
  bbox: [number, number, number, number] | null;
  geometry_count: number;
}

/** Persisted reconciliation classifications. */
export type ReconciliationType = 'new' | 'unmodified' | 'modified';

/** Required ownership and outcome for reconciliation browsing. */
export interface ReconciliationFeatureScope {
  submissionId: number;
  submissionUploadId: string;
  reconciliation: ReconciliationType;
}

/** A feature type stored in an upload and the number of its features. */
export interface SubmissionUploadFeatureType {
  feature_type_name: string;
  count: number;
}

/** Filters of the administrative submission upload feature type list. */
export interface SubmissionUploadFeatureTypeFilters {
  /** Count only features with this stored reconciliation outcome. Every feature is counted when omitted. */
  reconciliation?: ReconciliationType;
}

export interface SubmissionUploadFeatureTypesResponse {
  feature_types: SubmissionUploadFeatureType[];
  pagination: ApiPaginationResponseParams;
}

/** Property definitions observed for one feature type across an upload. */
export interface ISubmissionUploadFeatureTypePropertiesResponse {
  properties: IFeatureProperty[];
}

/** Ownership boundary for administrative upload browsing. */
export interface SubmissionUploadScope {
  submissionId: number;
  submissionUploadId: string;
}

/** An aggregated ingestion error of a submission upload. */
export interface SubmissionFeatureError {
  submission_feature_error_id: number;
  error_code: string;
  error_message: string;
  /** Feature type of the property the error is about. Null for an error that is not about a property. */
  feature_type_name: string | null;
  property_name: string | null;
  count: number;
}

export interface SubmissionFeatureErrorsResponse {
  errors: SubmissionFeatureError[];
  pagination: ApiPaginationResponseParams;
}
