import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { TICKETS_LIST_DEFAULT_SORT } from 'constants/ticket';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useNavigate } from 'react-router-dom';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { PortalListPageLayout } from './components/PortalListPageLayout';
import { PortalTicketsContainer } from './list/PortalTicketsContainer';

/**
 * Portal tickets page content for the current user.
 *
 * @return {*}
 */
export const PortalTicketPage = () => {
  const api = useApi();
  const navigate = useNavigate();
  const grid = useServerPaginatedGridState({ defaultSort: TICKETS_LIST_DEFAULT_SORT });
  const params = { search: grid.debouncedSearchTerm, ...grid.apiPagination };
  const ticketsQuery = useQuery({
    queryKey: ticketQueryKeys.list('user', params),
    queryFn: ({ signal }) => api.tickets.getTicketsForUser(params, { signal }),
    placeholderData: keepPreviousData
  });

  return (
    <PortalListPageLayout>
      <PortalTicketsContainer
        rows={ticketsQuery.data?.tickets ?? []}
        rowCount={ticketsQuery.data?.pagination.total ?? 0}
        paginationModel={grid.paginationModel}
        setPaginationModel={grid.handlePaginationChange}
        sortModel={grid.sortModel}
        setSortModel={grid.handleSortChange}
        searchTerm={grid.searchTerm}
        onSearch={grid.handleSearch}
        onRowClick={(ticketId) => navigate(`/portal/ticket/${ticketId}`)}
      />
    </PortalListPageLayout>
  );
};
