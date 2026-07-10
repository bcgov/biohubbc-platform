import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

export interface ISystemUser {
  system_user_id: number;
  user_identifier: string;
  user_guid: string | null;
  identity_source: string;
  record_end_date: string | null;
  role_ids: number[];
  role_names: string[];
  display_name: string | null;
  email: string | null;
}

export interface IGetSystemUsersResponse {
  users: ISystemUser[];
  pagination: ApiPaginationResponseParams;
}

export interface IUpdateSystemUser {
  record_end_date: string | null;
}

export type ISystemUsersQueryParams = ApiPaginationRequestOptions & {
  search?: string;
};
