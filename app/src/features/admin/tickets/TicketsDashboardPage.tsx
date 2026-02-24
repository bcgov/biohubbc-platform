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
import useDataLoader from 'hooks/useDataLoader';
import { ICreateTicketRequest, IGetTicketsResponse, ITicket } from 'interfaces/useTicketsApi.interface';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTicketDialog } from './components/dialog/CreateTicketDialog';
import { TicketsList } from './list/TicketsList';

const DEFAULT_PAGE_SIZE = 10;

/**
 * Admin tickets dashboard page with administrative tabs and ticket pagination.
 *
 * @return {*}
 */
export const TicketsDashboardPage = () => {
  const api = useApi();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'tickets'>('tickets');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [createError, setCreateError] = useState<string | undefined>();

  const ticketsLoader = useDataLoader((params: { page: number; limit: number; sort: 'create_date'; order: 'desc' }) =>
    api.tickets.getTickets(params)
  );

  useEffect(() => {
    ticketsLoader.refresh({
      page: page + 1,
      limit: rowsPerPage,
      sort: 'create_date',
      order: 'desc'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page, rowsPerPage]);

  const response: IGetTicketsResponse | undefined = ticketsLoader.data;
  const tickets: ITicket[] = response?.tickets ?? [];
  const totalTickets = response?.pagination.total ?? 0;

  const handleCreateTicket = async (payload: ICreateTicketRequest) => {
    try {
      setIsSaving(true);
      setError(undefined);
      setCreateError(undefined);

      const createdTicket = await api.tickets.createTicket(payload);

      setIsCreateOpen(false);
      await ticketsLoader.refresh({
        page: page + 1,
        limit: rowsPerPage,
        sort: 'create_date',
        order: 'desc'
      });

      navigate(`/admin/tickets/${createdTicket.ticket_id}`);
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
              setPage(0);
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
            tickets={tickets}
            isLoading={ticketsLoader.isLoading}
            onTicketClick={(ticketId) => navigate(`/admin/tickets/${ticketId}`)}
            emptyTitle="No tickets"
            emptyMessage="There are no tickets matching your filters."
          />
        </Box>

        {totalTickets > 0 && (
          <Box mt={3}>
            <TablePagination
              component="div"
              count={totalTickets}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(Number.parseInt(event.target.value, 10));
                setPage(0);
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
