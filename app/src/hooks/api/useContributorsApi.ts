import { AxiosInstance } from 'axios';
import { IContributorSystemUserOption } from 'interfaces/useContributorsApi.interface';
import {
  IContributor,
  IContributorUser,
  IContributorInput,
  IContributorUserInput,
  IContributorFilters,
  IContributorUserFilters,
  IContributorsResponse,
  IContributorUsersResponse
} from 'interfaces/useContributorsApi.interface';
import { ApiPaginationResponseParams } from 'types/pagination';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Administrative contributor and relationship API operations.
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
   * Get contributors.
   * @param id - Record identifier.
   * @returns API result.
   */
  const getContributor = async (id: number): Promise<IContributor> => {
    const { data } = await axios.get(`/api/administrative/contributors/${id}`);
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
  /**
   * List contributor-users.
   * @param filters - Domain filters.
   * @param pagination - Requested page.
   * @returns API result.
   */
  const listContributorUsers = async (
    filters: IContributorUserFilters,
    pagination: ApiPaginationRequestOptions
  ): Promise<IContributorUsersResponse> => {
    const { data } = await axios.get(`/api/administrative/contributor-users`, {
      params: { ...filters, ...pagination }
    });
    return data;
  };
  /**
   * Get contributor-users.
   * @param id - Record identifier.
   * @returns API result.
   */
  const getContributorUser = async (id: number): Promise<IContributorUser> => {
    const { data } = await axios.get(`/api/administrative/contributor-users/${id}`);
    return data;
  };
  /**
   * Create contributor-users.
   * @param input - New fields.
   * @returns API result.
   */
  const createContributorUser = async (input: IContributorUserInput): Promise<IContributorUser> => {
    const { data } = await axios.post(`/api/administrative/contributor-users`, input);
    return data;
  };
  /**
   * Delete contributor-users.
   * @param id - Record identifier.
   * @returns Completion.
   */
  const deleteContributorUser = async (id: number): Promise<void> => {
    await axios.delete(`/api/administrative/contributor-users/${id}`);
  };
  /**
   * List all identity sources for contributor user selection.
   * @param keyword - User label search.
   * @param pagination - Requested page.
   * @returns Bounded options and total metadata.
   */
  const listSystemUserOptions = async (
    keyword: string,
    pagination: ApiPaginationRequestOptions
  ): Promise<{ users: IContributorSystemUserOption[]; pagination: ApiPaginationResponseParams }> => {
    const { data } = await axios.get('/api/administrative/contributor-users/available-users', {
      params: { keyword, page: pagination.page, limit: pagination.limit }
    });
    return data;
  };
  return {
    listSystemUserOptions,
    listContributors,
    getContributor,
    createContributor,
    updateContributor,
    deleteContributor,
    listContributorUsers,
    getContributorUser,
    createContributorUser,
    deleteContributorUser
  };
};
