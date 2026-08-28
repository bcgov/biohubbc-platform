import { AxiosInstance } from 'axios';
import { IgcNotifyGenericMessage, IgcNotifyRecipient } from 'interfaces/useAdminApi.interface';
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
    getSubmissionFeatures,
    sendGCNotification,
    addSystemUser
  };
};

export default useAdminApi;
