import { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  IBoardDetail,
  IBoardRequest,
  IBoardsQueryParams,
  IBoardSwimlane,
  IBoardSwimlaneRequest,
  IBoardSwimlanesQueryParams,
  IBoardTicketCreateRequest,
  IBoardTicketRequest,
  IBoardTickets,
  IGetBoardsResponse,
  IGetBoardSwimlanesResponse
} from 'interfaces/useBoardsApi.interface';
import { ITag, ITagRequest } from 'interfaces/useTagsApi.interface';
import { ITicket } from 'interfaces/useTicketsApi.interface';

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
   * Create a tag and link it to a board, so applying it to a ticket puts the ticket on the board. The tag is a regular
   * tag, available to every ticket.
   *
   * @param {string} boardId
   * @param {ITagRequest} payload
   * @return {*} {Promise<ITag>} The created tag.
   */
  const createBoardTag = async (boardId: string, payload: ITagRequest): Promise<ITag> => {
    const { data } = await axios.post<ITag>(`/api/administrative/boards/${boardId}/tags`, payload);

    return data;
  };

  /**
   * Link an existing tag to a board. The tickets that have it are put on the board, and so are tickets it is applied to
   * later.
   *
   * @param {string} boardId
   * @param {string} tagId
   * @return {*} {Promise<void>}
   */
  const addBoardTag = async (boardId: string, tagId: string): Promise<void> => {
    await axios.put(`/api/administrative/boards/${boardId}/tags/${tagId}`);
  };

  /**
   * Unlink a tag from a board. The tag, and the board's tickets, are not affected.
   *
   * @param {string} boardId
   * @param {string} tagId
   * @return {*} {Promise<void>}
   */
  const deleteBoardTag = async (boardId: string, tagId: string): Promise<void> => {
    await axios.delete(`/api/administrative/boards/${boardId}/tags/${tagId}`);
  };

  /**
   * Get a board's open tickets grouped by lane.
   *
   * @param {string} boardId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IBoardTickets>} Every lane in display order with its tickets.
   */
  const getBoardTickets = async (
    boardId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IBoardTickets> => {
    const { data } = await axios.get<IBoardTickets>(`/api/administrative/boards/${boardId}/tickets`, options);

    return data;
  };

  /**
   * Create a ticket on a board, in its default lane, To Do.
   *
   * @param {string} boardId
   * @param {IBoardTicketCreateRequest} payload The ticket's fields.
   * @return {*} {Promise<ITicket>} The created ticket.
   */
  const createBoardTicket = async (boardId: string, payload: IBoardTicketCreateRequest): Promise<ITicket> => {
    const { data } = await axios.post<ITicket>(`/api/administrative/boards/${boardId}/tickets`, payload);

    return data;
  };

  /**
   * Put a ticket on a board, or move it to another of the board's lanes. Without a lane, a ticket not on the board goes
   * in its default lane, To Do, and a ticket on it stays in its lane.
   *
   * @param {string} boardId
   * @param {string} ticketId
   * @param {IBoardTicketRequest} payload The lane the ticket is moved in, if any.
   * @return {*} {Promise<void>}
   */
  const updateBoardTicket = async (boardId: string, ticketId: string, payload: IBoardTicketRequest): Promise<void> => {
    await axios.put(`/api/administrative/boards/${boardId}/tickets/${ticketId}`, payload);
  };

  /**
   * Take a ticket off a board. The ticket itself is not affected.
   *
   * @param {string} boardId
   * @param {string} ticketId
   * @return {*} {Promise<void>}
   */
  const deleteBoardTicket = async (boardId: string, ticketId: string): Promise<void> => {
    await axios.delete(`/api/administrative/boards/${boardId}/tickets/${ticketId}`);
  };

  /**
   * Get one page of a board's swimlanes, in display order unless a sort is given.
   *
   * @param {string} boardId
   * @param {IBoardSwimlanesQueryParams} params Page and sort.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IGetBoardSwimlanesResponse>} The page of swimlanes with server pagination totals.
   */
  const getBoardSwimlanes = async (
    boardId: string,
    params: IBoardSwimlanesQueryParams,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IGetBoardSwimlanesResponse> => {
    const { data } = await axios.get<IGetBoardSwimlanesResponse>(`/api/administrative/boards/${boardId}/swimlanes`, {
      params,
      ...options
    });

    return data;
  };

  /**
   * Create a swimlane at the end of a board.
   *
   * @param {string} boardId
   * @param {IBoardSwimlaneRequest} payload
   * @return {*} {Promise<IBoardSwimlane>} The created swimlane.
   */
  const createBoardSwimlane = async (boardId: string, payload: IBoardSwimlaneRequest): Promise<IBoardSwimlane> => {
    const { data } = await axios.post<IBoardSwimlane>(`/api/administrative/boards/${boardId}/swimlanes`, payload);

    return data;
  };

  /**
   * Update a board's swimlane, replacing its tags with the given set.
   *
   * @param {string} boardId
   * @param {string} boardSwimlaneId
   * @param {IBoardSwimlaneRequest} payload
   * @return {*} {Promise<IBoardSwimlane>} The updated swimlane.
   */
  const updateBoardSwimlane = async (
    boardId: string,
    boardSwimlaneId: string,
    payload: IBoardSwimlaneRequest
  ): Promise<IBoardSwimlane> => {
    const { data } = await axios.put<IBoardSwimlane>(
      `/api/administrative/boards/${boardId}/swimlanes/${boardSwimlaneId}`,
      payload
    );

    return data;
  };

  /**
   * Delete a board's swimlane, which must have no tickets.
   *
   * @param {string} boardId
   * @param {string} boardSwimlaneId
   * @return {*} {Promise<void>}
   */
  const deleteBoardSwimlane = async (boardId: string, boardSwimlaneId: string): Promise<void> => {
    await axios.delete(`/api/administrative/boards/${boardId}/swimlanes/${boardSwimlaneId}`);
  };

  return {
    getBoards,
    createBoard,
    getBoard,
    updateBoard,
    deleteBoard,
    createBoardTag,
    addBoardTag,
    deleteBoardTag,
    getBoardTickets,
    createBoardTicket,
    updateBoardTicket,
    deleteBoardTicket,
    getBoardSwimlanes,
    createBoardSwimlane,
    updateBoardSwimlane,
    deleteBoardSwimlane
  };
};
