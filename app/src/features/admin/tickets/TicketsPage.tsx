import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import TablePagination from '@mui/material/TablePagination';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { ICreateTicketRequest } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTicketDialog } from './components/dialog/CreateTicketDialog';
import { TicketsList } from './list/TicketsList';

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

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [createError, setCreateError] = useState<string | undefined>();

  const tickets = useServerPaginatedDataGrid({
    fetcher: (_, pagination) =>
      api.tickets.getTickets({
        ...pagination,
        sort: 'create_date',
        order: 'desc'
      }),
    extractData: (response) => response.tickets,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'create_date', sort: 'desc' },
    defaultPageSize: DEFAULT_PAGE_SIZE
  });

  const handleCreateTicket = async (payload: ICreateTicketRequest) => {
    try {
      setIsSaving(true);
      setError(undefined);
      setCreateError(undefined);

      await api.tickets.createTicket(payload);

      setIsCreateOpen(false);
      tickets.refresh();
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      setCreateError(apiError.message || 'Failed to create ticket.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Paper square elevation={0}>
        <Container maxWidth="xl" sx={{ py: 4, pb: 0 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h1" sx={{ ml: '-2px' }}>
              Administrative
            </Typography>
            {activeTab === 'tickets' && (
              <Button
                variant="contained"
                startIcon={<Icon path={mdiPlus} size={1} />}
                onClick={() => {
                  setCreateError(undefined);
                  setIsCreateOpen(true);
                }}>
                New Ticket
              </Button>
            )}
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_, value) => {
              setActiveTab(value);
              tickets.handlePaginationChange({ ...tickets.paginationModel, page: 0 });
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
        {error && (
          <Typography color="error" data-testid="tickets-page-error" mb={3}>
            {error}
          </Typography>
        )}

        <Box id="administrative-tickets-tabpanel" aria-labelledby="administrative-tickets-tab">
          <TicketsList
            tickets={tickets.data}
            isLoading={tickets.isLoading}
            onTicketClick={(ticketId) => navigate(`/admin/tickets/${ticketId}`)}
            emptyTitle="No tickets"
            emptyMessage="There are no tickets matching your filters."
          />
        </Box>

        {tickets.rowCount > 0 && (
          <Box mt={3}>
            <TablePagination
              component="div"
              count={tickets.rowCount}
              page={tickets.paginationModel.page}
              rowsPerPage={tickets.paginationModel.pageSize}
              onPageChange={(_, newPage) =>
                tickets.handlePaginationChange({ ...tickets.paginationModel, page: newPage })
              }
              onRowsPerPageChange={(event) => {
                tickets.handlePaginationChange({
                  page: 0,
                  pageSize: Number.parseInt(event.target.value, 10)
                });
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </Box>
        )}
      </Container>

      <CreateTicketDialog
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateError(undefined);
        }}
        onCreate={handleCreateTicket}
        isSaving={isSaving}
        error={createError}
      />
    </>
  );
};
