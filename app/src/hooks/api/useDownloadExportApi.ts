import { AxiosInstance } from 'axios';
import {
  CreateExportPayload,
  DownloadExport,
  DownloadExportDetail,
  DownloadFeatureType
} from 'interfaces/useDownloadExportApi.interface';

/**
 * Returns a set of supported api methods for working with CSV exports of downloads.
 *
 * Exports are authenticated-only and live under a ready download; see SIMSBIOHUB-954.
 * Intentionally no `listExports` method — `download.exports[]` is pre-joined onto each
 * row of `GET /api/download` (Phase 5a), so a standalone list call has no caller.
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

  return { createExport, getExport, getDownloadFeatureTypes };
};
