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

  /**
   * Get paginated submission feature properties by feature id.
   *
   * @param {string} submissionId
   * @param {string} submissionFeatureId
   * @param {ApiPaginationRequestOptions & SubmissionFeaturePropertyFilters} params
   * @return {Promise<ISubmissionFeaturePropertiesResponse>}
   */
  const getSubmissionFeatureProperties = async (
    submissionId: string,
    submissionFeatureId: string,
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
