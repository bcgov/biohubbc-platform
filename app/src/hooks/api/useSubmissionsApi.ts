import { AxiosInstance } from 'axios';
import { IListSubmissionsResponse } from 'interfaces/useSubmissionsApi.interface';

/**
 * Returns a set of supported CRUD api methods submissions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useSubmissionsApi = (axios: AxiosInstance) => {
  /**
   * Fetch all submissions.
   *
   * @return {*}  {Promise<IListSubmissionsResponse>}
   */
  const listSubmissions = async (): Promise<IListSubmissionsResponse> => {
    const { data } = await axios.get('/api/dwc/submission/list');

    return data;
  };

  /**
   * Fetch the signed URL of a submission by submission ID.
   *
   * @return {*}  {Promise<string>}
   */
  const getSignedUrl = async (submissionId: number): Promise<string> => {
    const { data } = await axios.get<string>(`/api/dwc/submission/${submissionId}/getSignedUrl`);

    return data;
  };

  const test = async (submissionId: number): Promise<any> => {
    const { data } = await axios.post(`/api/dataset/search-idx?submissionId=${submissionId}`);

    return data;
  }

  return {
    listSubmissions,
    getSignedUrl,
    test
  };
};

export default useSubmissionsApi;
