import { ApiPaginationRequestOptions } from 'types/pagination';

/** The teams and policies offered when assigning a policy to a team, before and during a search. */
export const TEAM_POLICY_ASSIGNMENT_OPTIONS_PAGINATION: ApiPaginationRequestOptions = {
  page: 1,
  limit: 25,
  sort: 'name',
  order: 'asc'
};
