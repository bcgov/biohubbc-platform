import { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  IBoardDetail,
  IBoardRequest,
  IBoardSwimlane,
  IBoardSwimlaneRequest,
  IBoardSwimlanesResponse,
  IBoardTicketsQueryParams,
  IBoardTicketsResponse,
  IGetBoardsResponse,
  IUpdateBoardSwimlaneOrderRequest
} from 'interfaces/useBoardsApi.interface';

/**
 * Returns a set of supported api methods for working with ticket boards and their swimlanes. Every endpoint is
 * administrative.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useBoardsApi = (axios: AxiosInstance) => {
  /**
   * Get every board with its tags and swimlane count.
   *
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IGetBoardsResponse>}
   */
  const getBoards = async (options?: Pick<AxiosRequestConfig, 'signal'>): Promise<IGetBoardsResponse> => {
    const { data } = await axios.get<IGetBoardsResponse>('/api/administrative/boards', options);

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
   * Get a board with its tags and every swimlane, hidden ones included, in display order.
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
   * Add a swimlane to the end of a board.
   *
   * @param {string} boardId
   * @param {IBoardSwimlaneRequest} payload
   * @return {*} {Promise<IBoardSwimlane>}
   */
  const createBoardSwimlane = async (boardId: string, payload: IBoardSwimlaneRequest): Promise<IBoardSwimlane> => {
    const { data } = await axios.post<IBoardSwimlane>(`/api/administrative/boards/${boardId}/swimlanes`, payload);

    return data;
  };

  /**
   * Update a swimlane, replacing its tags with the given set.
   *
   * @param {string} boardId
   * @param {string} swimlaneId
   * @param {IBoardSwimlaneRequest} payload
   * @return {*} {Promise<IBoardSwimlane>}
   */
  const updateBoardSwimlane = async (
    boardId: string,
    swimlaneId: string,
    payload: IBoardSwimlaneRequest
  ): Promise<IBoardSwimlane> => {
    const { data } = await axios.put<IBoardSwimlane>(
      `/api/administrative/boards/${boardId}/swimlanes/${swimlaneId}`,
      payload
    );

    return data;
  };

  /**
   * Delete a swimlane.
   *
   * @param {string} boardId
   * @param {string} swimlaneId
   * @return {*} {Promise<void>}
   */
  const deleteBoardSwimlane = async (boardId: string, swimlaneId: string): Promise<void> => {
    await axios.delete(`/api/administrative/boards/${boardId}/swimlanes/${swimlaneId}`);
  };

  /**
   * Set the left-to-right order of a board's swimlanes.
   *
   * @param {string} boardId
   * @param {IUpdateBoardSwimlaneOrderRequest} payload Every swimlane of the board, exactly once.
   * @return {*} {Promise<IBoardSwimlanesResponse>} The board's swimlanes in their new order.
   */
  const updateBoardSwimlaneOrder = async (
    boardId: string,
    payload: IUpdateBoardSwimlaneOrderRequest
  ): Promise<IBoardSwimlanesResponse> => {
    const { data } = await axios.put<IBoardSwimlanesResponse>(
      `/api/administrative/boards/${boardId}/swimlanes/order`,
      payload
    );

    return data;
  };

  /**
   * Get a board's tickets grouped by visible swimlane, with the tickets no visible lane matches as unsorted.
   *
   * @param {string} boardId
   * @param {IBoardTicketsQueryParams} params Whether closed tickets are included.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IBoardTicketsResponse>}
   */
  const getBoardTickets = async (
    boardId: string,
    params: IBoardTicketsQueryParams,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IBoardTicketsResponse> => {
    const { data } = await axios.get<IBoardTicketsResponse>(`/api/administrative/boards/${boardId}/tickets`, {
      params,
      ...options
    });

    return data;
  };

  return {
    getBoards,
    createBoard,
    getBoard,
    updateBoard,
    deleteBoard,
    createBoardSwimlane,
    updateBoardSwimlane,
    deleteBoardSwimlane,
    updateBoardSwimlaneOrder,
    getBoardTickets
  };
};
