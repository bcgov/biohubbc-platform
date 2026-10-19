import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import Typography from '@mui/material/Typography';
import { hashKey, keepPreviousData, QueryKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { TICKETS_LIST_DEFAULT_SORT } from 'constants/ticket';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useTagsQuery } from 'hooks/useTagsQuery';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ITagSummary } from 'interfaces/useTagsApi.interface';
import {
  IGetAdminTicketsResponse,
  ITicket,
  ITicketsQueryParams,
  IUpdateTicketRequest,
  TicketStatus
} from 'interfaces/useTicketsApi.interface';
import { useCallback, useState } from 'react';
import { refreshChangedQueries } from 'utils/query-client';
import {
  useCoordinatedMutation,
  cancelQueryForOptimisticUpdate,
  holdReload,
  hasConcurrentMutations
} from 'hooks/useCoordinatedMutation';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { CreateTicketDialog } from 'features/admin/tickets/components/dialog/create/CreateTicketDialog';
import { EditTicketDialog } from 'features/admin/tickets/components/dialog/edit/EditTicketDialog';
import { ITicketFormValues } from 'features/admin/tickets/components/dialog/form/TicketForm';
import { TicketsContainer } from 'features/admin/tickets/list/TicketsContainer';

/**
 * Administrative tickets page: the paginated ticket list in the shared administrative page layout, filterable by tag.
 *
 * Creating and editing refresh the server-sorted list once pending list mutations settle. Status toggles update
 * optimistically in place. Each change also refreshes the ticket's other cached copies: its detail pages, the
 * portal's lists and this list's other pages.
 *
 * @return {*}
 */
export const AdminTicketsPage = () => {
  const api = useApi();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'tickets'>('tickets');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ITicket | undefined>();
  const [tagFilter, setTagFilter] = useState<ITagSummary[]>([]);

  const tagsQuery = useTagsQuery();
  const grid = useServerPaginatedGridState({ defaultSort: TICKETS_LIST_DEFAULT_SORT });
  const listParams: ITicketsQueryParams = { search: grid.debouncedSearchTerm, ...grid.apiPagination };
  if (tagFilter.length) {
    listParams.tag_ids = tagFilter.map((tag) => tag.tag_id);
  }
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

  const deleteTicketMutation = useCoordinatedMutation({
    mutationKey: ticketQueryKeys.lists('admin'),
    mutationFn: (ticket: ITicket) => api.tickets.deleteTicket(ticket.ticket_id),
    onSuccess: async (_data, ticket) => {
      await queryClient.cancelQueries({ queryKey: ticketQueryKeys.lists('admin') });
      holdReload(queryClient, ticketQueryKeys.lists('admin'), ticketQueryKeys.lists('admin'), false);
      void refreshChangedQueries(queryClient, [
        ...changedQueryKeys.ticketDetail(ticket.ticket_id),
        ticketQueryKeys.lists('user')
      ]);
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
    onSettled: () => {
      closeDeleteTicketDialog();
    }
  });
  const { mutate: deleteTicket } = deleteTicketMutation;

  const toggleStatusMutation = useCoordinatedMutation({
    // Creates, edits and status toggles share this group so refreshes wait for pending optimistic changes.
    mutationKey: ticketQueryKeys.lists('admin'),
    mutationFn: ({ ticket, nextStatus }: { ticket: ITicket; nextStatus: TicketStatus; listKey: QueryKey }) =>
      api.tickets.updateTicketStatus(ticket.ticket_id, nextStatus),
    onMutate: async ({ ticket, nextStatus, listKey }) => {
      if (hasConcurrentMutations(queryClient, ticketQueryKeys.lists('admin'))) {
        holdReload(queryClient, ticketQueryKeys.lists('admin'), ticketQueryKeys.lists('admin'), false);
      }
      await cancelQueryForOptimisticUpdate(queryClient, listKey, ticketQueryKeys.lists('admin'));
      const response = queryClient.setQueryData<IGetAdminTicketsResponse>(
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
    onSuccess: async (updatedTicket, { ticket, nextStatus, listKey }, context) => {
      await cancelQueryForOptimisticUpdate(queryClient, listKey, ticketQueryKeys.lists('admin'));
      const currentRow = queryClient
        .getQueryData<IGetAdminTicketsResponse>(listKey)
        ?.tickets.find((row) => row.ticket_id === ticket.ticket_id);
      if (currentRow !== context.optimisticRow) {
        holdReload(queryClient, ticketQueryKeys.lists('admin'), listKey);
      }
      // Preserve newer optimistic rows. Overlapping changes reconcile from the server after the group settles.
      queryClient.setQueryData<IGetAdminTicketsResponse>(
        listKey,
        (current) =>
          current && {
            ...current,
            tickets: current.tickets.map((row) => (row === context.optimisticRow ? { ...row, ...updatedTicket } : row))
          }
      );
      for (const query of queryClient.getQueryCache().findAll({
        queryKey: ticketQueryKeys.lists('admin'),
        predicate: (query) => query.queryHash !== hashKey(listKey)
      })) {
        holdReload(queryClient, ticketQueryKeys.lists('admin'), query.queryKey);
      }
      void refreshChangedQueries(queryClient, [
        ...changedQueryKeys.ticketDetail(ticket.ticket_id),
        ticketQueryKeys.lists('user')
      ]);
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
      queryClient.setQueryData<IGetAdminTicketsResponse>(
        listKey,
        (current) =>
          current && {
            ...current,
            tickets: current.tickets.map((row) =>
              row === context?.optimisticRow ? { ...row, status: ticket.status } : row
            )
          }
      );
    }
  });
  const { mutate: toggleStatus } = toggleStatusMutation;

  const createTicketMutation = useCoordinatedMutation({
    mutationKey: ticketQueryKeys.lists('admin'),
    mutationFn: (values: ITicketFormValues) => api.tickets.createTicket(values),
    onSuccess: async () => {
      // Discard older reads now; reload all list pages after pending optimistic toggles settle.
      await queryClient.cancelQueries({ queryKey: ticketQueryKeys.lists('admin') });
      holdReload(queryClient, ticketQueryKeys.lists('admin'), ticketQueryKeys.lists('admin'), false);
      void refreshChangedQueries(queryClient, [ticketQueryKeys.lists('user')]);
      setIsCreateDialogOpen(false);
    },
    onError: showApiErrorSnackbar
  });

  const editTicketMutation = useCoordinatedMutation({
    mutationKey: ticketQueryKeys.lists('admin'),
    mutationFn: ({ ticketId, payload }: { ticketId: string; payload: IUpdateTicketRequest }) =>
      api.tickets.updateTicket(ticketId, payload),
    onSuccess: async (updatedTicket) => {
      await queryClient.cancelQueries({ queryKey: ticketQueryKeys.lists('admin') });
      holdReload(queryClient, ticketQueryKeys.lists('admin'), ticketQueryKeys.lists('admin'), false);
      void refreshChangedQueries(queryClient, [
        ...changedQueryKeys.ticketDetail(updatedTicket.ticket_id),
        ticketQueryKeys.lists('user')
      ]);
      setIsEditDialogOpen(false);
      setSelectedTicket(undefined);
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Updated ticket'
      });
    },
    onError: showApiErrorSnackbar
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

  /**
   * Filters the list to tickets with any of the picked tags, from the first page.
   *
   * @param {ITagSummary[]} tags The picked tags; none lists every ticket.
   * @returns {void}
   */
  const handleTagFilterChange = (tags: ITagSummary[]) => {
    setTagFilter(tags);
    grid.handlePaginationChange({ ...grid.paginationModel, page: 0 });
  };

  const handleEditTicket = useCallback((ticket: ITicket) => {
    setSelectedTicket(ticket);
    setIsEditDialogOpen(true);
  }, []);

  return (
    <>
      <AdminPageLayout
        title="Tickets"
        breadcrumbs={
          <Breadcrumbs aria-label="tickets breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              Tickets
            </Typography>
          </Breadcrumbs>
        }
        tabs={[
          {
            value: 'tickets',
            label: 'Tickets',
            id: 'administrative-tickets-tab',
            ariaControls: 'administrative-tickets-tabpanel'
          }
        ]}
        activeTab={activeTab}
        onTabChange={(value) => {
          setActiveTab(value);
          grid.handlePaginationChange({ ...grid.paginationModel, page: 0 });
        }}>
        <QueryErrorDialog error={ticketsQuery.error} label="tickets" />
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
          tagOptions={tagsQuery.data?.tags ?? []}
          tagFilter={tagFilter}
          onTagFilterChange={handleTagFilterChange}
        />
      </AdminPageLayout>

      <CreateTicketDialog
        open={isCreateDialogOpen}
        isLoading={createTicketMutation.isPending}
        onCancel={() => setIsCreateDialogOpen(false)}
        onSave={(values) => createTicketMutation.mutate(values)}
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
          onSubmit={(payload) => editTicketMutation.mutate({ ticketId: selectedTicket.ticket_id, payload })}
        />
      ) : null}
    </>
  );
};
