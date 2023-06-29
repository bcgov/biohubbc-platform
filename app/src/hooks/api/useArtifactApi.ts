import { AxiosInstance } from 'axios';

/**
 * Returns a set of supported CRUD api methods submissions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useArtifactApi = (axios: AxiosInstance) => {
  /**
   * Sends a list of artifact UUIDs to be deleted from the system.
   * This removes any associated data to an artifact, including S3 objects
   *
   * @param artifactUUIDs Array of UUIDs to delete
   * @returns {*} {Promise<boolean>} A boolean indicating success or failure of the delete process
   */
  const deleteArtifacts = async (artifactUUIDs: string[]): Promise<boolean> => {
    const { data } = await axios.post<boolean>(`/api/artifact/delete`, {
      artifactUUIDs
    });

    return data;
  };

  return {
    deleteArtifacts
  };
};

export default useArtifactApi;
