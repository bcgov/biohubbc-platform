import { AxiosInstance } from 'axios';
import {
  ICreateTicketCommentRequest,
  ICreateTicketRequest,
  IGetTicketsParams,
  IGetTicketsResponse,
  ITicket,
  ITicketStatusHistory,
  ITicketWithHistory,
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
   * @param {IGetTicketsParams} [params]
   * @return {*} {Promise<IGetTicketsResponse>}
   */
  const getTickets = async (params?: IGetTicketsParams): Promise<IGetTicketsResponse> => {
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
   * @return {*} {Promise<ITicketWithHistory>}
   */
  const getTicket = async (ticketId: string): Promise<ITicketWithHistory> => {
    const { data } = await axios.get(`/api/tickets/${ticketId}`);

    return data;
  };

  /**
   * Create a new ticket.
   *
   * @param {ICreateTicketRequest} payload
   * @return {*} {Promise<ITicket>}
   */
  const createTicket = async (payload: ICreateTicketRequest): Promise<ITicket> => {
    const { data } = await axios.post('/api/tickets', payload);

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
    const { data } = await axios.patch(`/api/tickets/${ticketId}`, payload);

    return data;
  };

  /**
   * Update the ticket status.
   *
   * @param {string} ticketId
   * @param {TicketStatus} status
   * @return {*} {Promise<ITicket>}
   */
  const updateTicketStatus = async (ticketId: string, status: TicketStatus): Promise<ITicket> => {
    const { data } = await axios.post(`/api/tickets/${ticketId}/status`, { status });

    return data;
  };

  /**
   * Add a comment to a ticket timeline.
   *
   * @param {string} ticketId
   * @param {ICreateTicketCommentRequest} payload
   * @return {*} {Promise<ITicketStatusHistory>}
   */
  const createTicketComment = async (
    ticketId: string,
    payload: ICreateTicketCommentRequest
  ): Promise<ITicketStatusHistory> => {
    const { data } = await axios.post(`/api/tickets/${ticketId}/comment`, payload);

    return data;
  };

  return {
    getTickets,
    getTicket,
    createTicket,
    updateTicket,
    updateTicketStatus,
    createTicketComment
  };
};
