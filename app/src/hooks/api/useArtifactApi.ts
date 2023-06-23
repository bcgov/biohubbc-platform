import { AxiosInstance } from 'axios';

/**
 * Returns a set of supported CRUD api methods submissions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useArtifactApi = (axios: AxiosInstance) => {
  const deleteArtifacts = async (artifactUUIDs: string[]): Promise<{ success: boolean }> => {
    const { data } = await axios.post<{ success: boolean }>(`/api/artifact/delete`, {
      artifactUUIDs
    });

    return data;
  };

  return {
    deleteArtifacts
  };
};

export default useArtifactApi;
