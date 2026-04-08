import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useApi } from 'hooks/useApi';
import { useTicketsListPageState } from 'hooks/useTicketsListPageState';
import { useNavigate } from 'react-router-dom';
import { PortalTicketsContainer } from './list/PortalTicketsContainer';
import { PageHeader } from 'components/header/PageHeader';

/**
 * Portal tickets page displaying tickets accessible to the current user.
 *
 * @return {*}
 */
export const PortalTicketsPage = () => {
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
    <Box>
      <PageHeader
        label={
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography variant="h1" sx={{ ml: '-2px' }}>
              My Tickets
            </Typography>
          </Box>
        }
      />

      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        <PortalTicketsContainer
          rows={rows}
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={handlePaginationChange}
          sortModel={sortModel}
          setSortModel={handleSortChange}
          searchTerm={searchTerm}
          onSearch={handleSearch}
          onRowClick={(ticketId) => navigate(`/portal/tickets/${ticketId}`)}
        />
      </Container>
    </Box>
  );
};
