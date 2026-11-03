import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PoliciesContainer } from 'features/admin/policies/components/PoliciesContainer';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';

/**
 * Policies tab of the administrative data requests page: the policies that represent data requests. Each policy opens
 * its own page. The table keeps its page, sort and search as local state and loads the matching page through a query.
 *
 * @returns {JSX.Element} Policies table.
 */
export const AdminDataRequestsPoliciesContent = () => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const search = { search: grid.debouncedSearchTerm };
  const policiesQuery = useQuery({
    queryKey: policyQueryKeys.list(search, grid.apiPagination),
    queryFn: ({ signal }) => biohubApi.policies.getPolicies(search, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  /**
   * Refreshes everything a policy change makes out of date: the policies and requests tables, cached policy pages,
   * and ticket timelines, which show the status of the data requests (policies) they link to.
   *
   * @returns {void}
   */
  const refreshPolicies = () =>
    refreshChangedQueries(queryClient, [...changedQueryKeys.policy(), ...changedQueryKeys.ticketDetails()]);

  return (
    <>
      <QueryErrorDialog error={policiesQuery.error} label="policies" />
      <PoliciesContainer
        policies={policiesQuery.data?.policies ?? []}
        rowCount={policiesQuery.data?.pagination.total ?? 0}
        paginationModel={grid.paginationModel}
        setPaginationModel={grid.handlePaginationChange}
        sortModel={grid.sortModel}
        setSortModel={grid.handleSortChange}
        refresh={refreshPolicies}
        searchTerm={grid.searchTerm}
        onSearch={grid.handleSearch}
      />
    </>
  );
};
