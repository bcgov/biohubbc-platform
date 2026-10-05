import { ApiPaginationResponseParams } from 'types/pagination';

export interface IContributor {
  contributor_id: number;
  client_id: string;
  description: string | null;
  record_end_date: string | null;
}
export interface IContributorUser {
  contributor_system_user_id: number;
  contributor_id: number;
  system_user_id: number;
  client_id: string;
  user_identifier: string;
  display_name: string | null;
  record_end_date: string | null;
}
export interface IContributorInput {
  clientId: string;
  description: string | null;
}
export interface IContributorUserInput {
  contributorId: number;
  systemUserId: number;
}
export interface IContributorFilters {
  keyword?: string;
  active_only?: boolean;
}
export interface IContributorUserFilters {
  keyword?: string;
  active_only?: boolean;
  contributor_id?: number;
}
export interface IContributorsResponse {
  contributors: IContributor[];
  pagination: ApiPaginationResponseParams;
}
export interface IContributorUsersResponse {
  contributor_users: IContributorUser[];
  pagination: ApiPaginationResponseParams;
}

export interface IContributorSystemUserOption {
  system_user_id: number;
  user_identifier: string;
  display_name: string | null;
  record_end_date: string | null;
}
