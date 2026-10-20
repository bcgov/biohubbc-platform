import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { IBoardDetail, IBoardRequest, IBoardsQueryParams, IGetBoardsResponse } from 'interfaces/useBoardsApi.interface';
import { ITag, ITagRequest } from 'interfaces/useTagsApi.interface';

/**
 * Returns a set of supported api methods for working with ticket boards. Every endpoint is administrative.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useBoardsApi = (axios: AxiosInstance) => {
  /**
   * Get one page of boards with their tags, optionally filtered by a name search.
   *
   * @param {IBoardsQueryParams} params Name search, page and sort.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IGetBoardsResponse>} The page of boards with server pagination totals.
   */
  const getBoards = async (
    params: IBoardsQueryParams,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IGetBoardsResponse> => {
    const { data } = await axios.get<IGetBoardsResponse>('/api/administrative/boards', { params, ...options });

    return data;
  };

  /**
   * Create a board.
   *
   * @param {IBoardRequest} payload
   * @return {*} {Promise<IBoardDetail>}
   */
  const createBoard = async (payload: IBoardRequest): Promise<IBoardDetail> => {
    const { data } = await axios.post<IBoardDetail>('/api/administrative/boards', payload);

    return data;
  };

  /**
   * Get a board with its tags.
   *
   * @param {string} boardId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IBoardDetail>}
   */
  const getBoard = async (boardId: string, options?: Pick<AxiosRequestConfig, 'signal'>): Promise<IBoardDetail> => {
    const { data } = await axios.get<IBoardDetail>(`/api/administrative/boards/${boardId}`, options);

    return data;
  };

  /**
   * Update a board, replacing its tags with the given set.
   *
   * @param {string} boardId
   * @param {IBoardRequest} payload
   * @return {*} {Promise<IBoardDetail>}
   */
  const updateBoard = async (boardId: string, payload: IBoardRequest): Promise<IBoardDetail> => {
    const { data } = await axios.put<IBoardDetail>(`/api/administrative/boards/${boardId}`, payload);

    return data;
  };

  /**
   * Delete a board and its swimlanes.
   *
   * @param {string} boardId
   * @return {*} {Promise<void>}
   */
  const deleteBoard = async (boardId: string): Promise<void> => {
    await axios.delete(`/api/administrative/boards/${boardId}`);
  };

  /**
   * Create a tag and add it to a board. The tag is a regular tag, available to every ticket and board.
   *
   * @param {string} boardId
   * @param {ITagRequest} payload
   * @return {*} {Promise<ITag>} The created tag.
   */
  const createBoardTag = async (boardId: string, payload: ITagRequest): Promise<ITag> => {
    const { data } = await axios.post<ITag>(`/api/administrative/boards/${boardId}/tags`, payload);

    return data;
  };

  return {
    getBoards,
    createBoard,
    getBoard,
    updateBoard,
    deleteBoard,
    createBoardTag
  };
};
