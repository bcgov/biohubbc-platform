import { AxiosInstance } from 'axios';
import {
  CreateDownloadRequest,
  CreateDownloadResponse,
  DownloadDetail,
  DownloadListResponse
} from 'interfaces/useDownloadApi.interface';
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

  /**
   * Create a new download job for the supplied search expression.
   *
   * @param {CreateDownloadRequest} payload
   * @return {Promise<CreateDownloadResponse>}
   */
  const createDownload = async (payload: CreateDownloadRequest): Promise<CreateDownloadResponse> => {
    const { data } = await axios.post<CreateDownloadResponse>('/api/download', payload);
    return data;
  };

  /**
   * Get the detail record for a single download by id. Powers the public
   * download page — status, header name, description, and lifecycle timestamps.
   *
   * @param {string} downloadId
   * @return {Promise<DownloadDetail>}
   */
  const getDownload = async (downloadId: string): Promise<DownloadDetail> => {
    const { data } = await axios.get<DownloadDetail>(`/api/download/${downloadId}`);
    return data;
  };

  return { getDownloads, createDownload, getDownload };
};
