import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { PortalPageLayout } from 'layouts/PortalPageLayout';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { PortalDataRequestsContent } from './content/PortalDataRequestsContent';

/**
 * Portal data requests page: one page at a time of the data requests made for the current user's teams.
 *
 * @returns {JSX.Element} The data requests header and paginated table.
 */
export const PortalDataRequestsPage = () => {
  const api = useApi();
  const dataRequestsGrid = useServerPaginatedGridState({ defaultSort: { field: 'create_date', sort: 'desc' } });
  const dataRequestsQuery = useQuery({
    queryKey: policyQueryKeys.userDataRequests(dataRequestsGrid.apiPagination),
    queryFn: ({ signal }) => api.dataRequest.getDataRequestsForUser(dataRequestsGrid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  return (
    <PortalPageLayout title="Data Requests">
      <QueryErrorDialog error={dataRequestsQuery.error} label="data requests" />
      <PortalDataRequestsContent
        rows={dataRequestsQuery.data?.data_requests ?? []}
        rowCount={dataRequestsQuery.data?.pagination.total ?? 0}
        paginationModel={dataRequestsGrid.paginationModel}
        setPaginationModel={dataRequestsGrid.handlePaginationChange}
        sortModel={dataRequestsGrid.sortModel}
        setSortModel={dataRequestsGrid.handleSortChange}
      />
    </PortalPageLayout>
  );
};
