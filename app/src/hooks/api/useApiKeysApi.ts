import { AxiosInstance } from 'axios';
import { IAccessKeyView, ICreateAccessKeyResponse } from 'interfaces/useApiKeysApi.interface';

/**
 * Returns a set of supported api methods for managing user API keys.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useApiKeysApi = (axios: AxiosInstance) => {
  /**
   * Create a new API key for the current user.
   *
   * The `plaintext_key` in the response is shown exactly once and cannot be recovered.
   *
   * @param {string} name - Human-readable label for the key.
   * @return {Promise<ICreateAccessKeyResponse>}
   */
  const createApiKey = async (name: string): Promise<ICreateAccessKeyResponse> => {
    const { data } = await axios.post<ICreateAccessKeyResponse>('/api/api-key', { name });
    return data;
  };

  /**
   * List all active API keys for the current user.
   *
   * @return {Promise<IAccessKeyView[]>}
   */
  const listApiKeys = async (): Promise<IAccessKeyView[]> => {
    const { data } = await axios.get<IAccessKeyView[]>('/api/api-key');
    return data;
  };

  /**
   * Revoke an API key owned by the current user.
   *
   * Sets `revoked_at` and `expires_at` to now. The key is immediately invalidated and
   * will no longer authorize requests, but remains visible in the key list.
   *
   * @param {string} accessKeyId - UUID of the key to revoke.
   * @return {Promise<void>}
   */
  const revokeApiKey = async (accessKeyId: string): Promise<void> => {
    await axios.patch(`/api/api-key/${accessKeyId}`);
  };

  /**
   * Soft-delete an API key owned by the current user.
   *
   * Sets `record_end_date`, `expires_at`, and (if not yet revoked) `revoked_at` to now.
   * The key is immediately invalidated and removed from the key list.
   *
   * @param {string} accessKeyId - UUID of the key to delete.
   * @return {Promise<void>}
   */
  const deleteApiKey = async (accessKeyId: string): Promise<void> => {
    await axios.delete(`/api/api-key/${accessKeyId}`);
  };

  return { createApiKey, listApiKeys, revokeApiKey, deleteApiKey };
};
