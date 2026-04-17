import { useTicketsListPageState } from 'hooks/useTicketsListPageState';
import { useApi } from 'hooks/useApi';
import { useNavigate } from 'react-router-dom';
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

  const {
    rows,
    rowCount,
    paginationModel,
    handlePaginationChange,
    sortModel,
    handleSortChange,
    searchTerm,
    handleSearch
  } = useTicketsListPageState(api.tickets.getTicketsForUser);

  return (
    <PortalListPageLayout>
      <PortalTicketsContainer
        rows={rows}
        rowCount={rowCount}
        paginationModel={paginationModel}
        setPaginationModel={handlePaginationChange}
        sortModel={sortModel}
        setSortModel={handleSortChange}
        searchTerm={searchTerm}
        onSearch={handleSearch}
        onRowClick={(ticketId) => navigate(`/portal/ticket/${ticketId}`)}
      />
    </PortalListPageLayout>
  );
};
