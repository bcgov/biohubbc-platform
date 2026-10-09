import { AxiosInstance, AxiosRequestConfig } from 'axios';
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
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request options, such as an abort signal.
   * @returns {Promise<ISubmissionUploadStatus>}
   */
  const getSubmissionUploadStatus = async (
    submissionId: number,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionUploadStatus> => {
    const { data } = await axios.get<ISubmissionUploadStatus>(
      `/api/administrative/submission/${submissionId}/status`,
      options
    );
    return data;
  };

  return {
    getSubmissionUploadStatus
  };
};
