import { AxiosInstance } from 'axios';
import { ISubmissionUploadStatus } from 'interfaces/useSubmissionStatusApi.interface';

/**
 * Returns a set of supported CRUD api methods for getting submission status
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useSubmissionsStatusApi = (axios: AxiosInstance) => {
  /**
   * Returns information about the submission upload status: malware scans, upload status, file count, etc.
   * @param {number} submissionId
   * @returns {Promise<ISubmissionUploadStatus>}
   */
  const getSubmissionUploadStatus = async (submissionId: number): Promise<ISubmissionUploadStatus> => {
    const { data } = await axios.get<ISubmissionUploadStatus>(`/api/administrative/submission/${submissionId}/status`);
    return data;
  };

  return {
    getSubmissionUploadStatus
  };
};
