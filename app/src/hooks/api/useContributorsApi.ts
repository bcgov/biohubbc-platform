import { AxiosInstance } from 'axios';
import {
  IContributor,
  IContributorInput,
  IContributorFilters,
  IContributorsResponse
} from 'interfaces/useContributorsApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Administrative contributor API operations.
 * @param axios - Authenticated API client.
 * @returns Resource operations.
 */
export const useContributorsApi = (axios: AxiosInstance) => {
  /**
   * List contributors.
   * @param filters - Domain filters.
   * @param pagination - Requested page.
   * @returns API result.
   */
  const listContributors = async (
    filters: IContributorFilters,
    pagination: ApiPaginationRequestOptions
  ): Promise<IContributorsResponse> => {
    const { data } = await axios.get(`/api/administrative/contributors`, { params: { ...filters, ...pagination } });
    return data;
  };
  /**
   * Create contributors.
   * @param input - New fields.
   * @returns API result.
   */
  const createContributor = async (input: IContributorInput): Promise<IContributor> => {
    const { data } = await axios.post(`/api/administrative/contributors`, input);
    return data;
  };
  /**
   * Update contributors.
   * @param id - Record identifier.
   * @param input - Replacement editable fields.
   * @returns API result.
   */
  const updateContributor = async (id: number, input: IContributorInput): Promise<IContributor> => {
    const { data } = await axios.put(`/api/administrative/contributors/${id}`, input);
    return data;
  };
  /**
   * Delete contributors.
   * @param id - Record identifier.
   * @returns Completion.
   */
  const deleteContributor = async (id: number): Promise<void> => {
    await axios.delete(`/api/administrative/contributors/${id}`);
  };
  return { listContributors, createContributor, updateContributor, deleteContributor };
};
