import { AxiosInstance } from 'axios';
import {
  ICompleteTicketUploadRequest,
  ICreateTicketCommentRequest,
  ICreateTicketUploadRequest,
  ICreateTicketUploadResponse,
  ICreateTicketSystemUser,
  ICreateTicketReferenceRequest,
  ICreateTicketRequest,
  IGetTicketsResponse,
  ITicketSystemUser,
  ITicket,
  ITicketArtifact,
  ITicketCommentLog,
  ITicketReference,
  ITicketExtended,
  ITicketArtifactDownloadResponse,
  ITicketsQueryParams,
  IUpdateTicketSystemUserStatusRequest,
  IUpdateTicketRequest,
  IUpdateTicketCommentRequest,
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
   * Update a ticket timeline comment.
   *
   * @param {string} ticketId
   * @param {string} ticketCommentId
   * @param {IUpdateTicketCommentRequest} payload
   * @return {*} {Promise<ITicketCommentLog>}
   */
  const updateTicketComment = async (
    ticketId: string,
    ticketCommentId: string,
    payload: IUpdateTicketCommentRequest
  ): Promise<ITicketCommentLog> => {
    const { data } = await axios.put(`/api/administrative/tickets/${ticketId}/comment/${ticketCommentId}`, payload);

    return data;
  };

  /**
   * Remove a ticket timeline comment.
   *
   * @param {string} ticketId
   * @param {string} ticketCommentId
   * @return {*} {Promise<void>}
   */
  const deleteTicketComment = async (ticketId: string, ticketCommentId: string): Promise<void> => {
    await axios.delete(`/api/administrative/tickets/${ticketId}/comment/${ticketCommentId}`);
  };

  /**
   * Initialize a ticket attachment upload.
   *
   * @param {string} ticketId
   * @param {ICreateTicketUploadRequest} payload
   * @return {Promise<ICreateTicketUploadResponse>}
   */
  const createTicketUpload = async (
    ticketId: string,
    payload: ICreateTicketUploadRequest
  ): Promise<ICreateTicketUploadResponse> => {
    const { data } = await axios.post(`/api/administrative/tickets/${ticketId}/upload`, payload);

    return data;
  };

  /**
   * Finalize a ticket attachment upload and trigger async scan workflow.
   *
   * @param {string} ticketId
   * @param {string} uploadId
   * @param {ICompleteTicketUploadRequest} payload
   * @return {Promise<ITicketArtifact>}
   */
  const completeTicketUpload = async (
    ticketId: string,
    uploadId: string,
    payload: ICompleteTicketUploadRequest
  ): Promise<ITicketArtifact> => {
    const { data } = await axios.put(`/api/administrative/tickets/${ticketId}/upload/${uploadId}`, payload);

    return data;
  };

  /**
   * Get a presigned download URL for a ticket attachment artifact.
   *
   * @param {string} ticketId
   * @param {string} ticketArtifactId
   * @return {Promise<ITicketArtifactDownloadResponse>}
   */
  const getTicketArtifactDownloadUrl = async (
    ticketId: string,
    ticketArtifactId: string
  ): Promise<ITicketArtifactDownloadResponse> => {
    const { data } = await axios.get(`/api/tickets/${ticketId}/artifact/${ticketArtifactId}`);

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

  /**
   * Assign one or more system users to a ticket.
   *
   * @param {string} ticketId
   * @param {ICreateTicketSystemUser[]} payload
   * @return {*} {Promise<ITicketSystemUser[]>}
   */
  const createTicketSystemUsers = async (
    ticketId: string,
    payload: ICreateTicketSystemUser[]
  ): Promise<ITicketSystemUser[]> => {
    const { data } = await axios.post(`/api/tickets/${ticketId}/system-user`, payload);

    return data;
  };

  /**
   * Update ticket system user status.
   *
   * @param {string} ticketId
   * @param {string} ticketSystemUserId
   * @param {IUpdateTicketSystemUserStatusRequest} payload
   * @return {*} {Promise<ITicketSystemUser>}
   */
  const updateTicketSystemUserStatus = async (
    ticketId: string,
    ticketSystemUserId: string,
    payload: IUpdateTicketSystemUserStatusRequest
  ): Promise<ITicketSystemUser> => {
    const { data } = await axios.patch(`/api/tickets/${ticketId}/system-user/${ticketSystemUserId}`, payload);

    return data;
  };

  /**
   * Remove a ticket system user (soft delete).
   *
   * @param {string} ticketId
   * @param {string} ticketSystemUserId
   * @return {*} {Promise<void>}
   */
  const deleteTicketSystemUser = async (ticketId: string, ticketSystemUserId: string): Promise<void> => {
    await axios.delete(`/api/tickets/${ticketId}/system-user/${ticketSystemUserId}`);
  };

  return {
    getTicketsForAdmin,
    getTicketForAdmin,
    createTicket,
    updateTicket,
    deleteTicket,
    updateTicketStatus,
    createTicketComment,
    updateTicketComment,
    deleteTicketComment,
    createTicketUpload,
    completeTicketUpload,
    getTicketArtifactDownloadUrl,
    createTicketReference,
    deleteTicketReference,
    getTicketsForUser,
    getTicketForUser,
    createTicketSystemUsers,
    updateTicketSystemUserStatus,
    deleteTicketSystemUser
  };
};
