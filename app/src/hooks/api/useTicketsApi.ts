import { AxiosInstance } from 'axios';
import {
  ICreateTicketCommentRequest,
  ICreateTicketReferenceRequest,
  ICreateTicketRequest,
  IGetTicketsResponse,
  ITicket,
  ITicketCommentLog,
  ITicketReference,
  ITicketExtended,
  ITicketsQueryParams,
  IUpdateTicketRequest,
  TicketStatus
} from 'interfaces/useTicketsApi.interface';
import qs from 'qs';

/**
 * Returns a set of supported api methods for working with tickets.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useTicketsApi = (axios: AxiosInstance) => {
  /**
   * Get tickets using optional filters and pagination options.
   *
   * @param {ITicketsQueryParams} [params]
   * @return {*} {Promise<IGetTicketsResponse>}
   */
  const getTicketsForAdmin = async (params?: ITicketsQueryParams): Promise<IGetTicketsResponse> => {
    const { data } = await axios.get('/api/administrative/tickets', {
      params,
      paramsSerializer: (params) => qs.stringify(params)
    });

    return data;
  };

  /**
   * Get a single ticket by ID.
   *
   * @param {string} ticketId
   * @return {*} {Promise<ITicketExtended>}
   */
  const getTicketForAdmin = async (ticketId: string): Promise<ITicketExtended> => {
    const { data } = await axios.get<ITicketExtended>(`/api/administrative/tickets/${ticketId}`);

    return data;
  };

  /**
   * Create a new ticket.
   *
   * @param {ICreateTicketRequest} payload
   * @return {*} {Promise<ITicket>}
   */
  const createTicket = async (payload: ICreateTicketRequest): Promise<ITicket> => {
    const { data } = await axios.post('/api/administrative/tickets', payload);

    return data;
  };

  /**
   * Update editable ticket fields.
   *
   * @param {string} ticketId
   * @param {IUpdateTicketRequest} payload
   * @return {*} {Promise<ITicket>}
   */
  const updateTicket = async (ticketId: string, payload: IUpdateTicketRequest): Promise<ITicket> => {
    const { data } = await axios.put(`/api/administrative/tickets/${ticketId}`, payload);

    return data;
  };

  /**
   * Remove a ticket by id.
   *
   * @param {string} ticketId
   * @return {*} {Promise<void>}
   */
  const deleteTicket = async (ticketId: string): Promise<void> => {
    await axios.delete(`/api/administrative/tickets/${ticketId}`);
  };

  /**
   * Update the ticket status.
   *
   * @param {string} ticketId
   * @param {TicketStatus} status
   * @return {*} {Promise<ITicket>}
   */
  const updateTicketStatus = async (ticketId: string, status: TicketStatus): Promise<ITicket> => {
    const { data } = await axios.put(`/api/administrative/tickets/${ticketId}/status`, { status });

    return data;
  };

  /**
   * Add a comment to a ticket timeline.
   *
   * @param {string} ticketId
   * @param {ICreateTicketCommentRequest} payload
   * @return {*} {Promise<ITicketCommentLog>}
   */
  const createTicketComment = async (
    ticketId: string,
    payload: ICreateTicketCommentRequest
  ): Promise<ITicketCommentLog> => {
    const { data } = await axios.post(`/api/administrative/tickets/${ticketId}/comment`, payload);

    return data;
  };

  /**
   * Add a reference from the source ticket to a target ticket.
   *
   * @param {string} ticketId
   * @param {ICreateTicketReferenceRequest} payload
   * @return {*} {Promise<ITicketReference[]>}
   */
  const createTicketReference = async (
    ticketId: string,
    payload: ICreateTicketReferenceRequest
  ): Promise<ITicketReference[]> => {
    const { data } = await axios.post(`/api/administrative/tickets/${ticketId}/reference`, payload);

    return data;
  };

  /**
   * Remove a ticket reference by id.
   *
   * @param {string} ticketId
   * @param {string} ticketReferenceId
   * @return {*} {Promise<void>}
   */
  const deleteTicketReference = async (ticketId: string, ticketReferenceId: string): Promise<void> => {
    await axios.delete(`/api/administrative/tickets/${ticketId}/reference/${ticketReferenceId}`);
  };

  /**
   * Get tickets accessible to the current user via team membership.
   *
   * @param {ITicketsQueryParams} [params]
   * @return {*} {Promise<IGetTicketsResponse>}
   */
  const getTicketsForUser = async (params?: ITicketsQueryParams): Promise<IGetTicketsResponse> => {
    const { data } = await axios.get('/api/tickets', {
      params,
      paramsSerializer: (params) => qs.stringify(params)
    });

    return data;
  };

  /**
   * Get a single ticket by ID.
   *
   * @param {string} ticketId
   * @return {*} {Promise<ITicketExtended>}
   */
  const getTicketForUser = async (ticketId: string): Promise<ITicketExtended> => {
    const { data } = await axios.get<ITicketExtended>(`/api/tickets/${ticketId}`);

    return data;
  };

  return {
    getTicketsForAdmin,
    getTicketForAdmin,
    createTicket,
    updateTicket,
    deleteTicket,
    updateTicketStatus,
    createTicketComment,
    createTicketReference,
    deleteTicketReference,
    getTicketsForUser,
    getTicketForUser
  };
};
