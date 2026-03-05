import { AxiosInstance } from 'axios';
import { DownloadListResponse, FragmentUrlResponse } from 'interfaces/useDownloadApi.interface';

/**
 * Returns API methods for download management.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useDownloadApi = (axios: AxiosInstance) => {
  /**
   * Get all downloads accessible to the current user.
   *
   * @return {Promise<DownloadListResponse>}
   */
  const getDownloads = async (): Promise<DownloadListResponse> => {
    const { data } = await axios.get<DownloadListResponse>('/api/download');
    return data;
  };

  /**
   * Get a signed URL to download a specific fragment of a download package.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} fragmentIndex - The zero-based fragment index.
   * @return {Promise<FragmentUrlResponse>}
   */
  const getFragmentUrl = async (downloadId: string, fragmentIndex: number): Promise<FragmentUrlResponse> => {
    const { data } = await axios.get<FragmentUrlResponse>(`/api/download/${downloadId}/fragment/${fragmentIndex}/url`);
    return data;
  };

  return { getDownloads, getFragmentUrl };
};
