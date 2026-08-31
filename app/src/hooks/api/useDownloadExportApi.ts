import { AxiosInstance } from 'axios';
import {
  CreateExportPayload,
  DownloadExport,
  DownloadExportDetail,
  DownloadExportListResponse,
  DownloadFeatureType
} from 'interfaces/useDownloadExportApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns a set of supported api methods for working with CSV exports of downloads.
 *
 * Export creation and presigned part retrieval require authentication; collection reads follow the
 * parent download's access rules. See SIMSBIOHUB-954.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useDownloadExportApi = (axios: AxiosInstance) => {
  /**
   * Creates a new CSV export for a ready download and enqueues the pipeline job.
   *
   * Backend returns 409 if the parent download is not `ready`, 403 if the caller
   * is not a team member, 401 if unauthenticated.
   *
   * @param {string} downloadId
   * @param {CreateExportPayload} payload
   * @return {Promise<DownloadExport>}
   */
  const createExport = async (downloadId: string, payload: CreateExportPayload): Promise<DownloadExport> => {
    const { data } = await axios.post<DownloadExport>(`/api/download/${downloadId}/export`, payload);
    return data;
  };

  /**
   * Fetches detail for a single export, including per-part presigned URLs when status is `ready`.
   *
   * URLs regenerate per request — callers must not cache them.
   *
   * @param {string} downloadId
   * @param {string} exportId
   * @return {Promise<DownloadExportDetail>}
   */
  const getExport = async (downloadId: string, exportId: string): Promise<DownloadExportDetail> => {
    const { data } = await axios.get<DownloadExportDetail>(`/api/download/${downloadId}/export/${exportId}`);
    return data;
  };

  /**
   * List exports belonging to a single download version.
   *
   * @param {string} downloadId - The parent download ID.
   * @param {string} downloadVersionId - The selected download version ID.
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination and sorting parameters.
   * @return {Promise<DownloadExportListResponse>} The selected version's paginated exports.
   */
  const listDownloadVersionExports = async (
    downloadId: string,
    downloadVersionId: string,
    pagination?: ApiPaginationRequestOptions
  ): Promise<DownloadExportListResponse> => {
    const { data } = await axios.get<DownloadExportListResponse>(
      `/api/download/${downloadId}/version/${downloadVersionId}/export`,
      { params: pagination }
    );
    return data;
  };

  /**
   * Lists the download's materialized feature types and their exportable columns,
   * which drive the export config picker.
   *
   * @param {string} downloadId
   * @return {Promise<DownloadFeatureType[]>}
   */
  const getDownloadFeatureTypes = async (downloadId: string): Promise<DownloadFeatureType[]> => {
    const { data } = await axios.get<DownloadFeatureType[]>(`/api/download/${downloadId}/feature-types`);
    return data;
  };

  /**
   * Lists the feature types and exportable columns materialized by one download version.
   *
   * @param {string} downloadId - The parent download ID.
   * @param {string} downloadVersionId - The selected download version ID.
   * @return {Promise<DownloadFeatureType[]>} The version's exportable feature types and columns.
   */
  const getDownloadVersionFeatureTypes = async (
    downloadId: string,
    downloadVersionId: string
  ): Promise<DownloadFeatureType[]> => {
    const { data } = await axios.get<DownloadFeatureType[]>(
      `/api/download/${downloadId}/version/${downloadVersionId}/feature-types`
    );
    return data;
  };

  return {
    createExport,
    getExport,
    listDownloadVersionExports,
    getDownloadFeatureTypes,
    getDownloadVersionFeatureTypes
  };
};
