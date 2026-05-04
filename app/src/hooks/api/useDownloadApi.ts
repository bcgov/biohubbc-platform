import { AxiosInstance } from 'axios';
import { DownloadListResponse } from 'interfaces/useDownloadApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns API methods for download management.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useDownloadApi = (axios: AxiosInstance) => {
  /**
   * Get paginated downloads accessible to the current user.
   *
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination params (page, limit, sort, order).
   * @return {Promise<DownloadListResponse>}
   */
  const getDownloads = async (pagination?: ApiPaginationRequestOptions): Promise<DownloadListResponse> => {
    const { data } = await axios.get<DownloadListResponse>('/api/download', { params: pagination });
    return data;
  };

  return { getDownloads };
};
