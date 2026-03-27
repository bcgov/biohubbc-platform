import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TicketsContainer } from './list/TicketsContainer';

const DEFAULT_PAGE_SIZE = 10;

/**
 * Admin tickets page with administrative tabs and ticket pagination.
 *
 * @return {*}
 */
export const TicketsPage = () => {
  const api = useApi();
  const navigate = useNavigate();

  // NOTE: More tab options will be added as more administrative features are added. For now, only tickets are supported.
  const [activeTab, setActiveTab] = useState<'tickets'>('tickets');

  const {
    response,
    rows,
    rowCount,
    paginationModel,
    handlePaginationChange,
    sortModel,
    handleSortChange,
    searchTerm,
    handleSearch,
    refresh,
    setData
  } = useServerPaginatedDataGrid({
    fetcher: (search, pagination) => api.tickets.getTicketsForAdmin({ search, ...pagination }),
    extractData: (response) => response.tickets,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'create_date', sort: 'desc' },
    defaultPageSize: DEFAULT_PAGE_SIZE
  });

  return (
    <>
      <Paper square elevation={0}>
        <Container maxWidth="xl" sx={{ py: 4, pb: 0 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h1" sx={{ ml: '-2px' }}>
              Administrative
            </Typography>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_, value) => {
              setActiveTab(value);
              handlePaginationChange({ ...paginationModel, page: 0 });
            }}
            aria-label="administrative tabs"
            sx={{ mt: 1.5 }}>
            <Tab
              value="tickets"
              label="Tickets"
              id="administrative-tickets-tab"
              aria-controls="administrative-tickets-tabpanel"
            />
          </Tabs>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        <TicketsContainer
          response={response}
          rows={rows}
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={handlePaginationChange}
          sortModel={sortModel}
          setSortModel={handleSortChange}
          searchTerm={searchTerm}
          onSearch={handleSearch}
          refresh={refresh}
          setData={setData}
          onRowClick={(ticketId) => navigate(`/admin/tickets/${ticketId}`)}
        />
      </Container>
    </>
  );
};
