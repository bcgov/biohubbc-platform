import { AxiosInstance } from 'axios';
import {
  ISubmissionFeaturePropertiesResponse,
  ISubmissionFeatureResponse,
  SubmissionFeaturePropertyFilters
} from 'interfaces/useFeaturesApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns a set of supported CRUD api methods submissions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useFeaturesApi = (axios: AxiosInstance) => {
  /**
   * Get a submission feature by its ID
   *
   * @param {number} submissionId
   * @param {number} submissionFeatureId
   * @return {Promise<ISubmissionFeatureResponse>}
   */
  const getSubmissionFeatureById = async (
    submissionId: number,
    submissionFeatureId: number
  ): Promise<ISubmissionFeatureResponse> => {
    const { data } = await axios.get(`api/submission/${submissionId}/features/${submissionFeatureId}`);

    return data;
  };

  /**
   * Get paginated submission feature properties by feature id.
   *
   * @param {number} submissionId
   * @param {number} submissionFeatureId
   * @param {ApiPaginationRequestOptions & SubmissionFeaturePropertyFilters} params
   * @return {Promise<ISubmissionFeaturePropertiesResponse>}
   */
  const getSubmissionFeatureProperties = async (
    submissionId: number,
    submissionFeatureId: number,
    params: ApiPaginationRequestOptions & SubmissionFeaturePropertyFilters
  ): Promise<ISubmissionFeaturePropertiesResponse> => {
    const { data } = await axios.get(`api/submission/${submissionId}/features/${submissionFeatureId}/properties`, {
      params,
      paramsSerializer: (queryParams) => qs.stringify(queryParams)
    });

    return data;
  };

  return {
    getSubmissionFeatureById,
    getSubmissionFeatureProperties
  };
};
