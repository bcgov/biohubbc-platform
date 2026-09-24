import { ApiPaginationResponseParams } from 'types/pagination';

export interface IContributor {
  contributor_id: number;
  client_id: string;
  description: string | null;
  record_end_date: string | null;
}
export interface IContributorInput {
  clientId: string;
  description: string | null;
}
export interface IContributorFilters {
  keyword?: string;
  active_only?: boolean;
}
export interface IContributorsResponse {
  contributors: IContributor[];
  pagination: ApiPaginationResponseParams;
}
