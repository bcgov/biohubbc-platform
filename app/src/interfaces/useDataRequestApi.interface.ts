export interface CreateDataRequestPayload {
  reason: string;
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