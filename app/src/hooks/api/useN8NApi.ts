import { AxiosInstance } from 'axios';

/**
 * Returns a set of supported api methods for working with n8n webhooks.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useN8NApi = (axios: AxiosInstance) => {
  const initiateSubmissionValidation = async (projectId: number, submissionId: number, fileType: string) => {
    await axios.post('/webhook/validate', {
      project_id: projectId,
      occurrence_submission_id: submissionId,
      file_type: fileType
    });
  };

  return {
    initiateSubmissionValidation
  };
};

export default useN8NApi;
