import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import {
  SubmissionUploadScope,
  SubmissionFeatureErrorsResponse,
  SubmissionUploadFeatureTypeFilters,
  SubmissionUploadFeatureTypesResponse,
  ISubmissionUploadFeatureGeometryExtent,
  ISubmissionUploadFeatureTypePropertiesResponse,
  IgcNotifyGenericMessage,
  IgcNotifyRecipient,
  ISubmissionUploadReconciliationCounts,
  ISubmissionUploadReviewDetail,
  ISubmissionUploadReviewFeatureRuleResponse,
  ISubmissionUploadReviewSecurityFeatureCountResponse,
  ISubmissionUploadReviewSecurityFeatureResponse,
  ISubmissionUploadReviewSelectedFeatureRuleResponse,
  SubmissionFeatureSecurityRulesFilters
} from 'interfaces/useAdminApi.interface';
import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';
import { ISubmissionFeaturePropertiesResponse, ISubmissionFeatureResponse } from 'interfaces/useFeaturesApi.interface';
import { ISubmissionFeatureForReviewResponse } from 'interfaces/useSubmissionsApi.interface';
import qs from 'qs';
import { ApiCursorPaginationRequestOptions, ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns a set of supported api methods for working with admin functions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useAdminApi = (axios: AxiosInstance) => {
  /**
   * Fetch one page of the aggregated ingestion errors of a submission upload.
   *
   * @param {SubmissionUploadScope} scope Submission and upload ownership boundary.
   * @param {ApiPaginationRequestOptions} pagination Page and sort options.
   * @param {Pick<AxiosRequestConfig, 'signal'>} options Request cancellation.
   * @returns {Promise<SubmissionFeatureErrorsResponse>} Errors with server pagination totals.
   */
  const listSubmissionFeatureErrors = async (
    scope: SubmissionUploadScope,
    pagination: ApiPaginationRequestOptions,
    options: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<SubmissionFeatureErrorsResponse> => {
    const { data } = await axios.get<SubmissionFeatureErrorsResponse>(
      `/api/administrative/submission/${scope.submissionId}/upload/${scope.submissionUploadId}/error`,
      { params: pagination, ...options }
    );
    return data;
  };

  /**
   * Load the blueprint a submission upload was created with.
   * @param {SubmissionUploadScope} scope Submission and upload ownership boundary.
   * @param {Pick<AxiosRequestConfig, 'signal'>} options Request cancellation.
   * @returns {Promise<IBlueprint>} The upload's blueprint.
   */
  const getSubmissionUploadBlueprint = async (
    scope: SubmissionUploadScope,
    options: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IBlueprint> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${scope.submissionId}/upload/${scope.submissionUploadId}/blueprint`,
      options
    );
    return data;
  };

  /**
   * Load the blueprint a submission's future uploads use by default.
   * @param {number} submissionId Submission identifier.
   * @param {Pick<AxiosRequestConfig, 'signal'>} options Request cancellation.
   * @returns {Promise<IBlueprint>} The submission's default blueprint.
   */
  const getSubmissionDefaultBlueprint = async (
    submissionId: number,
    options: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IBlueprint> => {
    const { data } = await axios.get(`/api/administrative/submission/${submissionId}/blueprint`, options);
    return data;
  };

  /**
   * Set the blueprint a submission's future uploads use by default.
   * @param {number} submissionId Submission identifier.
   * @param {number} blueprintId Available blueprint to use for future uploads.
   * @returns {Promise<void>} Resolves after the submission has been updated.
   */
  const updateSubmissionDefaultBlueprint = async (submissionId: number, blueprintId: number): Promise<void> => {
    await axios.patch(`/api/administrative/submission/${submissionId}`, { default_blueprint_id: blueprintId });
  };

  /**
   * Get unique property definitions present for a feature type across the whole upload.
   * @param {number} submissionId Owning submission.
   * @param {string} submissionUploadId Reviewed upload.
   * @param {string} featureType Canonical feature type name.
   * @param {Pick<AxiosRequestConfig, 'signal'>} options Request cancellation.
   * @returns {Promise<ISubmissionUploadFeatureTypePropertiesResponse>} Upload-scoped property definitions.
   */
  const getSubmissionUploadFeatureTypeProperties = async (
    submissionId: number,
    submissionUploadId: string,
    featureType: string,
    options: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionUploadFeatureTypePropertiesResponse> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/feature-types/${encodeURIComponent(featureType)}/properties`,
      options
    );
    return data;
  };

  /**
   * Fetch one page of the feature types stored in a submission upload, with the number of features of each.
   *
   * @param {SubmissionUploadScope} scope Submission and upload ownership boundary.
   * @param {SubmissionUploadFeatureTypeFilters} filters Optional reconciliation outcome to count.
   * @param {ApiPaginationRequestOptions} pagination Page and sort options.
   * @param {Pick<AxiosRequestConfig, 'signal'>} options Request cancellation.
   * @returns {Promise<SubmissionUploadFeatureTypesResponse>} Feature types with server pagination totals.
   */
  const listSubmissionUploadFeatureTypes = async (
    scope: SubmissionUploadScope,
    filters: SubmissionUploadFeatureTypeFilters,
    pagination: ApiPaginationRequestOptions,
    options: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<SubmissionUploadFeatureTypesResponse> => {
    const { data } = await axios.get<SubmissionUploadFeatureTypesResponse>(
      `/api/administrative/submission/${scope.submissionId}/upload/${scope.submissionUploadId}/feature-types`,
      { params: { ...filters, ...pagination }, ...options }
    );
    return data;
  };

  /**
   * Get the spatial extent of one current upload feature, including unpublished geometry.
   *
   * @param {number} submissionId Submission boundary.
   * @param {string} submissionUploadId Upload boundary.
   * @param {number} submissionFeatureId Feature to frame.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<ISubmissionUploadFeatureGeometryExtent>} Feature extent without tile credentials.
   */
  const getSubmissionUploadFeatureGeometryExtent = async (
    submissionId: number,
    submissionUploadId: string,
    submissionFeatureId: number,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionUploadFeatureGeometryExtent> => {
    const { data } = await axios.get<ISubmissionUploadFeatureGeometryExtent>(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/features/${submissionFeatureId}/extent`,
      options
    );
    return data;
  };

  /**
   * Fetch the stored reconciliation outcome counts for a submission upload.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<ISubmissionUploadReconciliationCounts>} Stored reconciliation outcome counts.
   */
  const getSubmissionUploadReconciliationCounts = async (
    submissionId: number,
    submissionUploadId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionUploadReconciliationCounts> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/reconciliation`,
      options
    );

    return data;
  };

  /**
   * Fetch one active submission upload review.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {string} submissionUploadReviewId UUID of the submission upload review.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<ISubmissionUploadReviewDetail>} The requested active review.
   */
  const getSubmissionUploadReview = async (
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionUploadReviewDetail> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}`,
      options
    );

    return data;
  };

  /**
   * Update the workflow status of one submission upload review.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {string} submissionUploadReviewId UUID of the submission upload review.
   * @param {ISubmissionUploadReviewDetail['status']} status New workflow status for the review.
   * @returns {Promise<ISubmissionUploadReviewDetail>} The updated review.
   */
  const updateSubmissionUploadReview = async (
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    status: ISubmissionUploadReviewDetail['status']
  ): Promise<ISubmissionUploadReviewDetail> => {
    const { data } = await axios.patch(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}`,
      { status }
    );

    return data;
  };

  /**
   * Fetch paginated features belonging to one submission upload.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {ApiPaginationRequestOptions} [pagination] Optional pagination and sorting parameters.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<ISubmissionFeatureForReviewResponse>} Paginated features belonging to the upload.
   */
  const getSubmissionUploadFeatures = async (
    submissionId: number,
    submissionUploadId: string,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionFeatureForReviewResponse> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/features`,
      {
        params: pagination,
        paramsSerializer: (params) => qs.stringify(params),
        ...options
      }
    );

    return data;
  };

  /**
   * Searches features in a submission upload using an optional expression tree and cursor pagination.
   *
   * @param {number} submissionId - Identifier of the submission that owns the upload.
   * @param {string} submissionUploadId - Identifier of the submission upload to search.
   * @param {ExpressionTreeExpression | null} expression - Applied expression tree, or null to return all upload features.
   * @param {ApiCursorPaginationRequestOptions} pagination - Cursor pagination and sorting options.
   * @param {Pick<AxiosRequestConfig, 'signal'> | undefined} options - Optional request cancellation configuration.
   * @returns {Promise<ISubmissionUploadReviewSecurityFeatureResponse>} Matching features and cursor pagination metadata.
   */
  const searchSubmissionUploadFeatures = async (
    submissionId: number,
    submissionUploadId: string,
    expression: ExpressionTreeExpression | null,
    pagination: ApiCursorPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionUploadReviewSecurityFeatureResponse> => {
    const { data } = await axios.post(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/features`,
      { expression: expression ?? undefined, pagination },
      options
    );
    return data;
  };

  /**
   * Counts features in a submission upload that match an optional expression tree.
   *
   * @param {number} submissionId - Identifier of the submission that owns the upload.
   * @param {string} submissionUploadId - Identifier of the submission upload to search.
   * @param {ExpressionTreeExpression | null} expression - Applied expression tree, or null to count all upload features.
   * @param {Pick<AxiosRequestConfig, 'signal'>} options - Request cancellation configuration.
   * @returns {Promise<ISubmissionUploadReviewSecurityFeatureCountResponse>} Total number of matching upload features.
   */
  const countSubmissionUploadFeatures = async (
    submissionId: number,
    submissionUploadId: string,
    expression: ExpressionTreeExpression | null,
    options: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionUploadReviewSecurityFeatureCountResponse> => {
    const { data } = await axios.post(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/features/count`,
      { expression: expression ?? undefined },
      options
    );
    return data;
  };

  /**
   * Fetch security rules assigned to one feature in a submission upload review.
   *
   * @param {number} submissionId - Identifier of the submission that owns the upload.
   * @param {string} submissionUploadId - Identifier of the submission upload.
   * @param {string} submissionUploadReviewId - Identifier of the security review.
   * @param {number} submissionFeatureId - Identifier of the feature.
   * @param {ApiPaginationRequestOptions} pagination - Pagination and sorting options.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] - Request cancellation.
   * @returns {Promise<ISubmissionUploadReviewFeatureRuleResponse>} Paginated assigned security rules.
   */
  const getSubmissionUploadReviewFeatureRules = async (
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    submissionFeatureId: number,
    pagination: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionUploadReviewFeatureRuleResponse> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}/security/features/${submissionFeatureId}/rules`,
      { params: pagination, paramsSerializer: (params) => qs.stringify(params), ...options }
    );
    return data;
  };

  /**
   * Fetch security-rule assignment states for selected submission features.
   *
   * Without selected IDs, assignment state covers the applied expression or, when omitted, the whole upload.
   *
   * @param {number} submissionId - Identifier of the submission that owns the upload.
   * @param {string} submissionUploadId - Identifier of the submission upload.
   * @param {string} submissionUploadReviewId - Identifier of the security review.
   * @param {number[]} submissionFeatureIds - Selected feature identifiers, or an empty array for all upload features.
   * @param {SubmissionFeatureSecurityRulesFilters} filters - Optional rule-name matching.
   * @param {ApiPaginationRequestOptions} pagination - Pagination and sorting options.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] - Request cancellation.
   * @returns {Promise<ISubmissionUploadReviewSelectedFeatureRuleResponse>} Paginated rule assignment states.
   */
  const getSubmissionUploadReviewSelectedFeatureRules = async (
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    submissionFeatureIds: number[],
    filters: SubmissionFeatureSecurityRulesFilters,
    pagination: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionUploadReviewSelectedFeatureRuleResponse> => {
    const { data } = await axios.post(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}/security/assignments`,
      {
        submissionFeatureIds,
        expression: filters.expression,
        search: filters.keyword,
        pagination
      },
      options
    );
    return data;
  };

  /**
   * Apply assignments for a security rule and selected submission features.
   *
   * Without selected IDs, the applied expression defines scope; omitting both selects the whole upload.
   *
   * @param {number} submissionId - Identifier of the submission that owns the upload.
   * @param {string} submissionUploadId - Identifier of the submission upload.
   * @param {string} submissionUploadReviewId - Identifier of the security review.
   * @param {number[]} submissionFeatureIds - Selected feature identifiers, or an empty array for all upload features.
   * @param {number} securityRuleId - Identifier of the security rule.
   * @param {ExpressionTreeExpression} [expression] - Applied expression used only without explicit feature IDs.
   * @returns {Promise<void>} Resolves after assignments are applied.
   */
  const insertSubmissionUploadReviewSecurityRuleAssignments = async (
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    submissionFeatureIds: number[],
    securityRuleId: number,
    expression?: ExpressionTreeExpression
  ): Promise<void> => {
    await axios.put(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}/security/rules/${securityRuleId}/assignments`,
      {
        submissionFeatureIds,
        expression
      }
    );
  };

  /**
   * Remove assignments for a security rule and selected submission features.
   *
   * Without selected IDs, the applied expression defines scope; omitting both selects the whole upload.
   *
   * @param {number} submissionId - Identifier of the submission that owns the upload.
   * @param {string} submissionUploadId - Identifier of the submission upload.
   * @param {string} submissionUploadReviewId - Identifier of the security review.
   * @param {number[]} submissionFeatureIds - Selected feature identifiers, or an empty array for all upload features.
   * @param {number} securityRuleId - Identifier of the security rule.
   * @param {ExpressionTreeExpression} [expression] - Applied expression used only without explicit feature IDs.
   * @returns {Promise<void>} Resolves after the assignments are removed.
   */
  const deleteSubmissionUploadReviewSecurityRuleAssignments = async (
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    submissionFeatureIds: number[],
    securityRuleId: number,
    expression?: ExpressionTreeExpression
  ): Promise<void> => {
    await axios.post(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}/security/rules/${securityRuleId}/assignments/remove`,
      { submissionFeatureIds, expression }
    );
  };

  /**
   * Removes direct security assignments for the selected upload features, or all features when none are selected.
   *
   * @param {number} submissionId - Identifier of the submission that owns the upload.
   * @param {string} submissionUploadId - Identifier of the submission upload to reset.
   * @param {string} submissionUploadReviewId - Identifier of the security review authorizing the reset.
   * @param {number[]} submissionFeatureIds - Selected feature IDs; empty means the whole upload.
   * @param {ExpressionTreeExpression} [expression] - Applied expression used only without explicit feature IDs.
   * @returns {Promise<void>} Resolves after the scoped security assignments are removed.
   */
  const deleteSubmissionUploadReviewSecurityAssignments = async (
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    submissionFeatureIds: number[],
    expression?: ExpressionTreeExpression
  ): Promise<void> => {
    await axios.post(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}/security/assignments/reset`,
      { submissionFeatureIds, expression }
    );
  };

  /**
   * Fetch one feature belonging to a submission upload, including unpublished review rows.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {number} submissionFeatureId ID of the feature to return.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<ISubmissionFeatureResponse>} The requested submission feature.
   */
  const getSubmissionUploadFeature = async (
    submissionId: number,
    submissionUploadId: string,
    submissionFeatureId: number,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionFeatureResponse> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/features/${submissionFeatureId}`,
      options
    );

    return data;
  };

  /**
   * Fetch paginated properties for a feature belonging to a submission upload.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {number} submissionFeatureId ID of the feature whose properties should be returned.
   * @param {ApiPaginationRequestOptions & { search?: string }} params Pagination, sorting, and optional search parameters.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<ISubmissionFeaturePropertiesResponse>} Paginated properties for the requested feature.
   */
  const getSubmissionUploadFeatureProperties = async (
    submissionId: number,
    submissionUploadId: string,
    submissionFeatureId: number,
    params: ApiPaginationRequestOptions & { search?: string },
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionFeaturePropertiesResponse> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/features/${submissionFeatureId}/properties`,
      { params, paramsSerializer: (value) => qs.stringify(value), ...options }
    );

    return data;
  };

  /**
   * Fetch the paginated features for a submission for administrative review.
   *
   * @param {number} submissionId ID of the submission whose features should be returned.
   * @param {ApiPaginationRequestOptions} [pagination] Optional pagination and sorting parameters.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<ISubmissionFeatureForReviewResponse>} Paginated submission features.
   */
  const getSubmissionFeatures = async (
    submissionId: number,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionFeatureForReviewResponse> => {
    const { data } = await axios.get(`/api/administrative/submission/${submissionId}/features`, {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params),
      ...options
    });

    return data;
  };

  /**
   * Send notification to recipient
   *
   * @param {IgcNotifyRecipient} recipient
   * @param {IgcNotifyGenericMessage} message
   * @return {*}  {Promise<number>}
   */
  const sendGCNotification = async (
    recipient: IgcNotifyRecipient,
    message: IgcNotifyGenericMessage
  ): Promise<boolean> => {
    const { status } = await axios.post(`/api/gcnotify/send`, {
      recipient,
      message
    });

    return status === 200;
  };

  /**
   * Adds a new system user with role.
   *
   * Note: Will fail if the system user already exists.
   *
   * @param {string} userIdentifier
   * @param {string} identitySource
   * @param {number} roleId
   * @return {*}
   */
  const addSystemUser = async (
    userIdentifier: string,
    userGuid: string,
    identitySource: string,
    roleId: number
  ): Promise<boolean> => {
    const { status } = await axios.post(`/api/user/add`, {
      userGuid: userGuid,
      identitySource: identitySource,
      userIdentifier: userIdentifier,
      roleId: roleId
    });

    return status === 200;
  };

  return {
    listSubmissionFeatureErrors,
    getSubmissionUploadBlueprint,
    getSubmissionDefaultBlueprint,
    updateSubmissionDefaultBlueprint,
    getSubmissionUploadFeatureTypeProperties,
    listSubmissionUploadFeatureTypes,
    getSubmissionUploadReconciliationCounts,
    getSubmissionUploadFeatureGeometryExtent,
    getSubmissionUploadReview,
    updateSubmissionUploadReview,
    getSubmissionUploadFeatures,
    searchSubmissionUploadFeatures,
    countSubmissionUploadFeatures,
    getSubmissionUploadReviewFeatureRules,
    getSubmissionUploadReviewSelectedFeatureRules,
    insertSubmissionUploadReviewSecurityRuleAssignments,
    deleteSubmissionUploadReviewSecurityRuleAssignments,
    deleteSubmissionUploadReviewSecurityAssignments,
    getSubmissionUploadFeature,
    getSubmissionUploadFeatureProperties,
    getSubmissionFeatures,
    sendGCNotification,
    addSystemUser
  };
};

export default useAdminApi;
