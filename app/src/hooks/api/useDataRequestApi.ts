import { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  CreateDataRequestPayload,
  CreateTicketDataRequestPayload,
  DataRequestFeatureTypesResponse,
  DataRequestListItem,
  DataRequestListResponse,
  DataRequestRecipientsResponse,
  DataRequestResponse
} from 'interfaces/useDataRequestApi.interface';
import { ApiPaginationRequestOptions, ApiSearchParams } from 'types/pagination';

/**
 * Returns a set of supported api methods for working with data requests.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useDataRequestApi = (axios: AxiosInstance) => {
  /**
   * Creates a new data request for access to secured data.
   *
   * @param {CreateDataRequestPayload} payload
   * @return {Promise<DataRequestResponse>}
   */
  const createTicketDataRequest = async (
    ticketId: string,
    payload: CreateTicketDataRequestPayload
  ): Promise<DataRequestResponse> => {
    const { data } = await axios.post<DataRequestResponse>(`/api/tickets/${ticketId}/data-request`, payload);
    return data;
  };

  /**
   * Creates a new data request for the supplied search expression and feature-type set.
   *
   * @param {CreateDataRequestPayload} payload
   * @return {Promise<DataRequestResponse>}
   */
  const createDataRequest = async (payload: CreateDataRequestPayload): Promise<DataRequestResponse> => {
    const { data } = await axios.post<DataRequestResponse>('/api/data-request', payload);
    return data;
  };

  /**
   * Gets one page of every data request in the system, for administrators.
   *
   * @param {ApiSearchParams} [searchParams] Search matched against the request reason.
   * @param {ApiPaginationRequestOptions} [pagination] The page and sort.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {Promise<DataRequestListResponse>}
   */
  const getDataRequests = async (
    searchParams?: ApiSearchParams,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<DataRequestListResponse> => {
    const params = { ...searchParams, ...pagination };
    const { data } = await axios.get<DataRequestListResponse>('/api/administrative/data-requests', {
      params,
      ...options
    });

    return data;
  };

  /**
   * Gets one data request by ID, for administrators.
   *
   * @param {string} dataRequestId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {Promise<DataRequestListItem>}
   */
  const getDataRequest = async (
    dataRequestId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<DataRequestListItem> => {
    const { data } = await axios.get<DataRequestListItem>(
      `/api/administrative/data-requests/${dataRequestId}`,
      options
    );

    return data;
  };

  /**
   * Gets the unique feature types a data request asks for, each with the expression that limits it, for
   * administrators.
   *
   * @param {string} dataRequestId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {Promise<DataRequestFeatureTypesResponse>}
   */
  const getDataRequestFeatureTypes = async (
    dataRequestId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<DataRequestFeatureTypesResponse> => {
    const { data } = await axios.get<DataRequestFeatureTypesResponse>(
      `/api/administrative/data-requests/${dataRequestId}/features/types`,
      options
    );

    return data;
  };

  /**
   * Gets the recipients of a data request: the members of the team its policy is assigned to, for administrators.
   *
   * @param {string} dataRequestId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {Promise<DataRequestRecipientsResponse>}
   */
  const getDataRequestRecipients = async (
    dataRequestId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<DataRequestRecipientsResponse> => {
    const { data } = await axios.get<DataRequestRecipientsResponse>(
      `/api/administrative/data-requests/${dataRequestId}/recipients`,
      options
    );

    return data;
  };

  /**
   * Removes a recipient from a data request by ending their membership of the team its policy is assigned to.
   *
   * @param {string} dataRequestId
   * @param {number} systemUserId System user ID of the recipient to remove.
   * @return {Promise<void>}
   */
  const deleteDataRequestRecipient = async (dataRequestId: string, systemUserId: number): Promise<void> => {
    await axios.delete(`/api/administrative/data-requests/${dataRequestId}/recipients/${systemUserId}`);
  };

  return {
    createTicketDataRequest,
    createDataRequest,
    getDataRequests,
    getDataRequest,
    getDataRequestFeatureTypes,
    getDataRequestRecipients,
    deleteDataRequestRecipient
  };
};
