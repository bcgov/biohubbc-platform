import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useTicketsListPageState } from 'hooks/useTicketsListPageState';
import { ITicket, IUpdateTicketRequest, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTicketDialog } from './components/dialog/create/CreateTicketDialog';
import { EditTicketDialog } from './components/dialog/edit/EditTicketDialog';
import { ITicketFormValues } from './components/dialog/form/TicketForm';
import { TicketsContainer } from './list/TicketsContainer';

/**
 * Admin tickets page with administrative tabs and ticket pagination.
 *
 * @return {*}
 */
export const TicketsPage = () => {
  const api = useApi();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();

  // NOTE: More tab options will be added as more administrative features are added. For now, only tickets are supported.
  const [activeTab, setActiveTab] = useState<'tickets'>('tickets');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ITicket | undefined>();

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
  } = useTicketsListPageState(api.tickets.getTicketsForAdmin);

  const closeDeleteTicketDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  const showApiErrorSnackbar = useCallback(
    (caughtError: unknown) => {
      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    },
    [dialogContext]
  );

  const handleDeleteTicket = useCallback(
    (ticket: ITicket) => {
      const handleConfirmDelete = async () => {
        try {
          await api.tickets.deleteTicket(ticket.ticket_id);
          refresh();
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: (
              <Typography variant="body2" component="div">
                Ticket <strong>#{ticket.ticket_slug}</strong> removed.
              </Typography>
            )
          });
        } catch (caughtError) {
          showApiErrorSnackbar(caughtError);
        } finally {
          closeDeleteTicketDialog();
        }
      };

      dialogContext.setYesNoDialog({
        dialogTitle: 'Remove ticket?',
        dialogContent: (
          <Typography component="div" color="textSecondary">
            Removing ticket <strong>#{ticket.ticket_slug}</strong> cannot be undone. Are you sure you want to proceed?
          </Typography>
        ),
        yesButtonLabel: 'Remove Ticket',
        noButtonLabel: 'Cancel',
        yesButtonProps: { color: 'error' },
        onClose: closeDeleteTicketDialog,
        onNo: closeDeleteTicketDialog,
        open: true,
        onYes: handleConfirmDelete
      });
    },
    [api.tickets, closeDeleteTicketDialog, dialogContext, refresh, showApiErrorSnackbar]
  );

  const handleToggleTicketStatus = useCallback(
    async (ticket: ITicket, nextStatus: TicketStatus) => {
      if (!response) {
        return;
      }

      const optimisticRows = rows.map((existingTicket) =>
        existingTicket.ticket_id === ticket.ticket_id ? { ...existingTicket, status: nextStatus } : existingTicket
      );
      const previousTicket = rows.find((existingTicket) => existingTicket.ticket_id === ticket.ticket_id);

      setData({ ...response, tickets: optimisticRows });

      try {
        const updatedTicket = await api.tickets.updateTicketStatus(ticket.ticket_id, nextStatus);

        setData({
          ...response,
          tickets: optimisticRows.map((existingTicket) =>
            existingTicket.ticket_id === ticket.ticket_id ? { ...existingTicket, ...updatedTicket } : existingTicket
          )
        });

        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: (
            <Typography variant="body2" component="div">
              Ticket <strong>#{ticket.ticket_slug}</strong> {nextStatus === 'closed' ? 'closed' : 'reopened'}.
            </Typography>
          )
        });
      } catch (caughtError) {
        if (previousTicket) {
          setData({
            ...response,
            tickets: rows.map((existingTicket) =>
              existingTicket.ticket_id === ticket.ticket_id ? previousTicket : existingTicket
            )
          });
        }
        showApiErrorSnackbar(caughtError);
      }
    },
    [api.tickets, dialogContext, response, rows, setData, showApiErrorSnackbar]
  );

  const handleCreateTicket = useCallback(
    async (values: ITicketFormValues) => {
      if (!response) {
        return;
      }

      try {
        setIsSubmitting(true);
        const createdTicket = await api.tickets.createTicket(values);

        setData({
          ...response,
          tickets: [createdTicket, ...rows],
          pagination: {
            ...response.pagination,
            total: response.pagination.total + 1
          }
        });

        setIsCreateDialogOpen(false);
      } catch (caughtError) {
        showApiErrorSnackbar(caughtError);
      } finally {
        setIsSubmitting(false);
      }
    },
    [api.tickets, response, rows, setData, showApiErrorSnackbar]
  );

  const handleEditTicket = useCallback((ticket: ITicket) => {
    setSelectedTicket(ticket);
    setIsEditDialogOpen(true);
  }, []);

  const handleEditTicketSave = useCallback(
    async (payload: IUpdateTicketRequest) => {
      if (!response || !selectedTicket) {
        return;
      }

      try {
        setIsEditingTicket(true);
        const updatedTicket = await api.tickets.updateTicket(selectedTicket.ticket_id, payload);

        setData({
          ...response,
          tickets: rows.map((ticket) =>
            ticket.ticket_id === updatedTicket.ticket_id ? { ...ticket, ...updatedTicket } : ticket
          )
        });

        setIsEditDialogOpen(false);
        setSelectedTicket(undefined);

        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'Updated ticket'
        });
      } catch (caughtError) {
        showApiErrorSnackbar(caughtError);
      } finally {
        setIsEditingTicket(false);
      }
    },
    [api.tickets, dialogContext, response, rows, selectedTicket, setData, showApiErrorSnackbar]
  );

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
          rows={rows}
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={handlePaginationChange}
          sortModel={sortModel}
          setSortModel={handleSortChange}
          searchTerm={searchTerm}
          onSearch={handleSearch}
          onAddTicket={() => setIsCreateDialogOpen(true)}
          rowActions={{
            onEditTicket: handleEditTicket,
            onToggleTicketStatus: handleToggleTicketStatus,
            onDeleteTicket: handleDeleteTicket
          }}
          onRowClick={(ticketId) => navigate(`/admin/tickets/${ticketId}`)}
        />
      </Container>

      <CreateTicketDialog
        open={isCreateDialogOpen}
        isLoading={isSubmitting}
        onCancel={() => setIsCreateDialogOpen(false)}
        onSave={handleCreateTicket}
      />

      {selectedTicket ? (
        <EditTicketDialog
          open={isEditDialogOpen}
          isLoading={isEditingTicket}
          ticket={selectedTicket}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedTicket(undefined);
          }}
          onSubmit={handleEditTicketSave}
        />
      ) : null}
    </>
  );
};
