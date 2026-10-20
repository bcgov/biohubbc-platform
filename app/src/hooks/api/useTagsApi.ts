import { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  IGetTagsResponse,
  ITag,
  ITagRequest,
  ITagsQueryParams,
  ITicketTagsResponse,
  IUpdateTicketTagsRequest
} from 'interfaces/useTagsApi.interface';

/**
 * Returns a set of supported api methods for working with ticket tags. Every endpoint is administrative.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useTagsApi = (axios: AxiosInstance) => {
  /**
   * Get one page of tags, ordered by name unless a sort is given, optionally filtered by a name search or a board.
   * The server returns its default page size when no page is given.
   *
   * @param {ITagsQueryParams} params Name search, board, page and sort.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IGetTagsResponse>} The page of tags with server pagination totals.
   */
  const getTags = async (
    params: ITagsQueryParams,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IGetTagsResponse> => {
    const { data } = await axios.get<IGetTagsResponse>('/api/administrative/tags', { params, ...options });

    return data;
  };

  /**
   * Get one tag.
   *
   * @param {string} tagId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<ITag>}
   */
  const getTag = async (tagId: string, options?: Pick<AxiosRequestConfig, 'signal'>): Promise<ITag> => {
    const { data } = await axios.get<ITag>(`/api/administrative/tags/${tagId}`, options);

    return data;
  };

  /**
   * Create a tag. Tag names are unique, ignoring case.
   *
   * @param {ITagRequest} payload
   * @return {*} {Promise<ITag>}
   */
  const createTag = async (payload: ITagRequest): Promise<ITag> => {
    const { data } = await axios.post<ITag>('/api/administrative/tags', payload);

    return data;
  };

  /**
   * Replace a tag's name, description and color.
   *
   * @param {string} tagId
   * @param {ITagRequest} payload The tag's complete editable fields.
   * @return {*} {Promise<ITag>}
   */
  const updateTag = async (tagId: string, payload: ITagRequest): Promise<ITag> => {
    const { data } = await axios.put<ITag>(`/api/administrative/tags/${tagId}`, payload);

    return data;
  };

  /**
   * Delete a tag, removing it from every ticket, board and swimlane.
   *
   * @param {string} tagId
   * @return {*} {Promise<void>}
   */
  const deleteTag = async (tagId: string): Promise<void> => {
    await axios.delete(`/api/administrative/tags/${tagId}`);
  };

  /**
   * Get a ticket's current tags and its tag history.
   *
   * @param {string} ticketId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<ITicketTagsResponse>}
   */
  const getTicketTags = async (
    ticketId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ITicketTagsResponse> => {
    const { data } = await axios.get<ITicketTagsResponse>(`/api/administrative/tickets/${ticketId}/tags`, options);

    return data;
  };

  /**
   * Replace a ticket's tags with the given set.
   *
   * @param {string} ticketId
   * @param {IUpdateTicketTagsRequest} payload The complete tag set.
   * @return {*} {Promise<ITicketTagsResponse>} The ticket's tags and tag history after the change.
   */
  const updateTicketTags = async (
    ticketId: string,
    payload: IUpdateTicketTagsRequest
  ): Promise<ITicketTagsResponse> => {
    const { data } = await axios.put<ITicketTagsResponse>(`/api/administrative/tickets/${ticketId}/tags`, payload);

    return data;
  };

  return {
    getTags,
    getTag,
    createTag,
    updateTag,
    deleteTag,
    getTicketTags,
    updateTicketTags
  };
};
