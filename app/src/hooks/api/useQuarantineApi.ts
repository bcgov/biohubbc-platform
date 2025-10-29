import { AxiosInstance } from 'axios';
import {
  ICompleteQuarantineUploadMetadata,
  IQuarantineUploadPart,
  PresignedUploadUrlResponse,
  SubmissionRecordWithQuarantineResponse
} from 'interfaces/useQuarantineApi.interface';

/**
 * Returns a set of supported CRUD api methods for quarantined records
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useQuarantineApi = (axios: AxiosInstance) => {
  /**
   * Fetch all submissions that are in quarantine
   *
   * @return {*}  {Promise<QuarantineecordWithQuarantineResponse>}
   */
  const getQuarantinedSubmissionsForAdmins = async (): Promise<SubmissionRecordWithQuarantineResponse> => {
    const { data } = await axios.get(`api/administrative/submission/quarantine`);

    return data;
  };

  /**
   * Get presigned URLs to upload submission files
   *
   * @param {number} expectedSizeBytes
   * @returns {Promise<PresignedUploadUrlResponse>}
   */
  const getSubmissionUploadUrls = async (expectedSizeBytes: number): Promise<PresignedUploadUrlResponse> => {
    const { data } = await axios.post(`api/submission/quarantine`, { expectedSizeBytes });

    return data;
  };

  /**
   * Update the submission upload as completed
   *
   * @param {string} quarantineId
   * @param {string} uploadId
   * @param {string} key
   * @param {IQuarantineUploadPart[]} parts
   * @param {ICompleteQuarantineUploadMetadata} metadata
   * @returns {Promise<void>}
   */
  const completeQuarantineUpload = async (
    quarantineId: string,
    uploadId: string,
    key: string,
    parts: IQuarantineUploadPart[],
    metadata: ICompleteQuarantineUploadMetadata
  ): Promise<void> => {
    await axios.put(`api/submission/quarantine/${quarantineId}`, { uploadId, key, parts, metadata });
  };

  /**
   * Trigger a malware scan for a specific quarantine record.
   *
   * @param {string} quarantineId
   * @returns {Promise<void>}
   */
  const scanQuarantineForMalware = async (quarantineId: string): Promise<void> => {
    await axios.post(`api/submission/quarantine/${quarantineId}/scan`);
  };

  /**
   * Skip malware scan validation for a specific quarantine record.
   *
   * @param {string} quarantineId
   * @returns {Promise<void>}
   */
  const skipQuarantineMalwareScan = async (quarantineId: string): Promise<void> => {
    await axios.post(`api/submission/quarantine/${quarantineId}/promote`);
  };

  return {
    getQuarantinedSubmissionsForAdmins,
    getSubmissionUploadUrls,
    completeQuarantineUpload,
    scanQuarantineForMalware,
    skipQuarantineMalwareScan
  };
};
