import { AxiosInstance } from 'axios';

export interface CreateDataRequestPayload {
  reason: string;
  team_id?: string;
}

export interface DataRequestStatus {
  data_request_status_id: string;
  data_request_id: string;
  comment_id: string | null;
  request_status: 'REQUESTED' | 'APPROVED' | 'DENIED';
}

export interface DataRequestResponse {
  data_request_id: string;
  reason: string;
  team_id: string;
  requested_by: number;
  data_request_status: DataRequestStatus;
}

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
  const createDataRequest = async (payload: CreateDataRequestPayload): Promise<DataRequestResponse> => {
    const { data } = await axios.post<DataRequestResponse>('/api/data-request', payload);
    return data;
  };

  return {
    createDataRequest
  };
};
