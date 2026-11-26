import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { TICKETS_LIST_DEFAULT_SORT } from 'constants/ticket';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useNavigate } from 'react-router-dom';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { PortalPageLayout } from 'layouts/PortalPageLayout';
import { PortalTicketsContent } from './content/PortalTicketsContent';

/**
 * Portal tickets page: the tickets of the current user, each opening its own page.
 *
 * @return {JSX.Element} The tickets header and table.
 */
export const PortalTicketsPage = () => {
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
    <PortalPageLayout title="Tickets">
      <QueryErrorDialog error={ticketsQuery.error} label="tickets" />
      <PortalTicketsContent
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
    </PortalPageLayout>
  );
};
