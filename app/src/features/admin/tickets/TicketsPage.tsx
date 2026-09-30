import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { keepPreviousData, QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TICKETS_LIST_DEFAULT_SORT } from 'constants/ticket';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { IGetTicketsResponse, ITicket, IUpdateTicketRequest, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cancelQueryForOptimisticUpdate,
  holdReloadIfConcurrent,
  joinMutationGroup,
  refreshChangedQueries,
  settleMutationGroup
} from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { CreateTicketDialog } from './components/dialog/create/CreateTicketDialog';
import { EditTicketDialog } from './components/dialog/edit/EditTicketDialog';
import { ITicketFormValues } from './components/dialog/form/TicketForm';
import { TicketsContainer } from './list/TicketsContainer';

/**
 * Admin tickets page with administrative tabs and ticket pagination.
 *
 * Creating, editing and closing a ticket write the result into the page on screen, so the row stays where it is;
 * deleting one reloads the list. Each change also refreshes the ticket's other cached copies: its detail pages, the
 * portal's lists and this list's other pages.
 *
 * @return {*}
 */
export const TicketsPage = () => {
  const api = useApi();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();
  const queryClient = useQueryClient();

  // NOTE: More tab options will be added as more administrative features are added. For now, only tickets are supported.
  const [activeTab, setActiveTab] = useState<'tickets'>('tickets');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ITicket | undefined>();

  const grid = useServerPaginatedGridState({ defaultSort: TICKETS_LIST_DEFAULT_SORT });
  const listParams = { search: grid.debouncedSearchTerm, ...grid.apiPagination };
  const ticketsQueryKey = ticketQueryKeys.list('admin', listParams);
  const ticketsQuery = useQuery({
    queryKey: ticketsQueryKey,
    queryFn: ({ signal }) => api.tickets.getTicketsForAdmin(listParams, { signal }),
    placeholderData: keepPreviousData
  });

  const showApiErrorSnackbar = useCallback(
    (error: Error) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: error.message
      });
    },
    [dialogContext]
  );

  const closeDeleteTicketDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  const deleteTicketMutation = useMutation({
    mutationFn: (ticket: ITicket) => api.tickets.deleteTicket(ticket.ticket_id),
    onSuccess: (_data, ticket) => {
      refreshChangedQueries(queryClient, changedQueryKeys.ticket(ticket.ticket_id));
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Ticket <strong>#{ticket.ticket_slug}</strong> removed.
          </Typography>
        )
      });
    },
    onError: showApiErrorSnackbar,
    onSettled: closeDeleteTicketDialog
  });
  const { mutate: deleteTicket } = deleteTicketMutation;

  const toggleStatusMutation = useMutation({
    // Every status toggle in the list shares this key, so a reload of the list waits for the last of them.
    mutationKey: ticketQueryKeys.lists('admin'),
    mutationFn: ({ ticket, nextStatus }: { ticket: ITicket; nextStatus: TicketStatus; listKey: QueryKey }) =>
      api.tickets.updateTicketStatus(ticket.ticket_id, nextStatus),
    onMutate: async ({ ticket, nextStatus, listKey }) => {
      joinMutationGroup(queryClient, ticketQueryKeys.lists('admin'));
      await cancelQueryForOptimisticUpdate(queryClient, listKey, ticketQueryKeys.lists('admin'));
      const response = queryClient.setQueryData<IGetTicketsResponse>(
        listKey,
        (current) =>
          current && {
            ...current,
            tickets: current.tickets.map((row) =>
              row.ticket_id === ticket.ticket_id ? { ...row, status: nextStatus } : row
            )
          }
      );
      const optimisticRow = response?.tickets.find((row) => row.ticket_id === ticket.ticket_id);
      return { optimisticRow };
    },
    onSuccess: (updatedTicket, { ticket, nextStatus, listKey }, context) => {
      // The response is written only to the row this toggle wrote: a newer toggle of the row replaced it, and its
      // own response describes the ticket as it is now.
      queryClient.setQueryData<IGetTicketsResponse>(
        listKey,
        (current) =>
          current && {
            ...current,
            tickets: current.tickets.map((row) => (row === context.optimisticRow ? { ...row, ...updatedTicket } : row))
          }
      );
      refreshChangedQueries(queryClient, changedQueryKeys.ticket(ticket.ticket_id), ticketQueryKeys.lists('admin'));
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Ticket <strong>#{ticket.ticket_slug}</strong> {nextStatus === 'closed' ? 'closed' : 'reopened'}.
          </Typography>
        )
      });
    },
    // Rows toggle independently, so the rollback touches only this toggle's row, and every failure is reported here.
    onError: (error, { ticket, listKey }, context) => {
      showApiErrorSnackbar(error);
      queryClient.setQueryData<IGetTicketsResponse>(
        listKey,
        (current) =>
          current && {
            ...current,
            tickets: current.tickets.map((row) =>
              row === context?.optimisticRow ? { ...row, status: ticket.status } : row
            )
          }
      );
    },
    onSettled: () => settleMutationGroup(queryClient, ticketQueryKeys.lists('admin'))
  });
  const { mutate: toggleStatus } = toggleStatusMutation;

  const createTicketMutation = useMutation({
    mutationFn: ({ values }: { values: ITicketFormValues; listKey: QueryKey }) => api.tickets.createTicket(values),
    onSuccess: (createdTicket, { listKey }) => {
      queryClient.setQueryData<IGetTicketsResponse>(
        listKey,
        (current) =>
          current && {
            ...current,
            tickets: [createdTicket, ...current.tickets],
            pagination: { ...current.pagination, total: current.pagination.total + 1 }
          }
      );
      refreshChangedQueries(queryClient, changedQueryKeys.ticketLists(), ticketQueryKeys.lists('admin'));
      setIsCreateDialogOpen(false);
    },
    onError: showApiErrorSnackbar
  });

  const editTicketMutation = useMutation({
    mutationKey: ticketQueryKeys.lists('admin'),
    onMutate: () => joinMutationGroup(queryClient, ticketQueryKeys.lists('admin')),
    mutationFn: ({ ticketId, payload }: { ticketId: string; payload: IUpdateTicketRequest; listKey: QueryKey }) =>
      api.tickets.updateTicket(ticketId, payload),
    onSuccess: (updatedTicket, { listKey }) => {
      // The whole row is written from the response, which can predate a status toggle saved alongside; the list
      // then reloads once they have all settled instead.
      if (!holdReloadIfConcurrent(queryClient, ticketQueryKeys.lists('admin'), listKey)) {
        queryClient.setQueryData<IGetTicketsResponse>(
          listKey,
          (current) =>
            current && {
              ...current,
              tickets: current.tickets.map((row) =>
                row.ticket_id === updatedTicket.ticket_id ? { ...row, ...updatedTicket } : row
              )
            }
        );
      }
      refreshChangedQueries(
        queryClient,
        changedQueryKeys.ticket(updatedTicket.ticket_id),
        ticketQueryKeys.lists('admin')
      );
      setIsEditDialogOpen(false);
      setSelectedTicket(undefined);
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Updated ticket'
      });
    },
    onError: showApiErrorSnackbar,
    onSettled: () => settleMutationGroup(queryClient, ticketQueryKeys.lists('admin'))
  });

  const handleDeleteTicket = useCallback(
    (ticket: ITicket) => {
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
        onYes: () => deleteTicket(ticket)
      });
    },
    [closeDeleteTicketDialog, deleteTicket, dialogContext]
  );

  const handleToggleTicketStatus = useCallback(
    (ticket: ITicket, nextStatus: TicketStatus) => toggleStatus({ ticket, nextStatus, listKey: ticketsQueryKey }),
    [ticketsQueryKey, toggleStatus]
  );

  const handleEditTicket = useCallback((ticket: ITicket) => {
    setSelectedTicket(ticket);
    setIsEditDialogOpen(true);
  }, []);

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
              grid.handlePaginationChange({ ...grid.paginationModel, page: 0 });
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
          rows={ticketsQuery.data?.tickets ?? []}
          rowCount={ticketsQuery.data?.pagination.total ?? 0}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          searchTerm={grid.searchTerm}
          onSearch={grid.handleSearch}
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
        isLoading={createTicketMutation.isPending}
        onCancel={() => setIsCreateDialogOpen(false)}
        onSave={(values) => createTicketMutation.mutate({ values, listKey: ticketsQueryKey })}
      />

      {selectedTicket ? (
        <EditTicketDialog
          open={isEditDialogOpen}
          isLoading={editTicketMutation.isPending}
          ticket={selectedTicket}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedTicket(undefined);
          }}
          onSubmit={(payload) =>
            editTicketMutation.mutate({ ticketId: selectedTicket.ticket_id, payload, listKey: ticketsQueryKey })
          }
        />
      ) : null}
    </>
  );
};
