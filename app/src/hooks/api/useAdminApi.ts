import { AxiosInstance } from 'axios';
import {
  IgcNotifyGenericMessage,
  IgcNotifyRecipient,
  ISubmissionUploadReconciliationCounts,
  ISubmissionUploadReviewDetail
} from 'interfaces/useAdminApi.interface';
import { ISubmissionFeaturePropertiesResponse, ISubmissionFeatureResponse } from 'interfaces/useFeaturesApi.interface';
import { ISubmissionFeatureForReviewResponse } from 'interfaces/useSubmissionsApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns a set of supported api methods for working with admin functions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useAdminApi = (axios: AxiosInstance) => {
  /**
   * Fetch the stored reconciliation outcome counts for a submission upload.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @returns {Promise<ISubmissionUploadReconciliationCounts>} Stored reconciliation outcome counts.
   */
  const getSubmissionUploadReconciliationCounts = async (
    submissionId: number,
    submissionUploadId: string
  ): Promise<ISubmissionUploadReconciliationCounts> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/reconciliation`
    );

    return data;
  };

  /**
   * Fetch one active submission upload review.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {string} submissionUploadReviewId UUID of the submission upload review.
   * @returns {Promise<ISubmissionUploadReviewDetail>} The requested active review.
   */
  const getSubmissionUploadReview = async (
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string
  ): Promise<ISubmissionUploadReviewDetail> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}`
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
   * @returns {Promise<ISubmissionFeatureForReviewResponse>} Paginated features belonging to the upload.
   */
  const getSubmissionUploadFeatures = async (
    submissionId: number,
    submissionUploadId: string,
    pagination?: ApiPaginationRequestOptions
  ): Promise<ISubmissionFeatureForReviewResponse> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/features`,
      {
        params: pagination,
        paramsSerializer: (params) => qs.stringify(params)
      }
    );

    return data;
  };

  /**
   * Fetch one feature belonging to a submission upload, including unpublished review rows.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {number} submissionFeatureId ID of the feature to return.
   * @returns {Promise<ISubmissionFeatureResponse>} The requested submission feature.
   */
  const getSubmissionUploadFeature = async (
    submissionId: number,
    submissionUploadId: string,
    submissionFeatureId: number
  ): Promise<ISubmissionFeatureResponse> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/features/${submissionFeatureId}`
    );

    return data;
  };

  /**
   * Fetch paginated properties for a feature belonging to a submission upload.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {number} submissionFeatureId ID of the feature whose properties should be returned.
   * @param {ApiPaginationRequestOptions & { search?: string }} options Pagination, sorting, and optional search parameters.
   * @returns {Promise<ISubmissionFeaturePropertiesResponse>} Paginated properties for the requested feature.
   */
  const getSubmissionUploadFeatureProperties = async (
    submissionId: number,
    submissionUploadId: string,
    submissionFeatureId: number,
    options: ApiPaginationRequestOptions & { search?: string }
  ): Promise<ISubmissionFeaturePropertiesResponse> => {
    const { data } = await axios.get(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/features/${submissionFeatureId}/properties`,
      { params: options, paramsSerializer: (params) => qs.stringify(params) }
    );

    return data;
  };

  /**
   * Fetch the paginated features for a submission for administrative review.
   *
   * @param {number} submissionId ID of the submission whose features should be returned.
   * @param {ApiPaginationRequestOptions} [pagination] Optional pagination and sorting parameters.
   * @returns {Promise<ISubmissionFeatureForReviewResponse>} Paginated submission features.
   */
  const getSubmissionFeatures = async (
    submissionId: number,
    pagination?: ApiPaginationRequestOptions
  ): Promise<ISubmissionFeatureForReviewResponse> => {
    const { data } = await axios.get(`/api/administrative/submission/${submissionId}/features`, {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params)
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
    getSubmissionUploadReconciliationCounts,
    getSubmissionUploadReview,
    updateSubmissionUploadReview,
    getSubmissionUploadFeatures,
    getSubmissionUploadFeature,
    getSubmissionUploadFeatureProperties,
    getSubmissionFeatures,
    sendGCNotification,
    addSystemUser
  };
};

export default useAdminApi;
