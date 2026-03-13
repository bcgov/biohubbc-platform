import { AxiosInstance } from 'axios';
import { ISubmissionFeatureResponse } from 'interfaces/useFeaturesApi.interface';

/**
 * Returns a set of supported CRUD api methods submissions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useFeaturesApi = (axios: AxiosInstance) => {
  /**
   * Get a submission feature by its ID
   * Also gets related features if there is any
   *
   * @param {string} submissionId
   * @param {string} submissionFeatureId
   * @return {Promise<ISubmissionFeatureResponse>}
   */
  const getSubmissionFeatureById = async (
    submissionId: string,
    submissionFeatureId: string
  ): Promise<ISubmissionFeatureResponse> => {
    const { data } = await axios.get(`api/submission/${submissionId}/features/${submissionFeatureId}`);

    return data;
  };

  return {
    getSubmissionFeatureById
  };
};
