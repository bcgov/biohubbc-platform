import { mdiClose, mdiDotsVertical, mdiMagnify, mdiPencil, mdiRefresh, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IGetTicketsResponse, ITicket, IUpdateTicketRequest, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useCallback, useMemo, useState } from 'react';
import { IServerPaginationProps } from 'types/pagination';
import { getRelativeTimeLabel } from 'utils/date';
import { CreateTicketDialog } from '../components/dialog/create/CreateTicketDialog';
import { EditTicketDialog } from '../components/dialog/edit/EditTicketDialog';
import { ITicketFormValues } from '../components/dialog/form/TicketForm';

interface ITicketsContainerProps extends IServerPaginationProps {
  response: IGetTicketsResponse | undefined;
  rows: ITicket[];
  searchTerm: string;
  onSearch: (term: string) => void;
  refresh: () => void;
  setData: (data: IGetTicketsResponse) => void;
  onRowClick: (ticketId: string) => void;
}

/**
 * Tickets container with list actions and dialogs.
 *
 * @param {ITicketsContainerProps} props
 * @return {*}
 */
export const TicketsContainer = (props: ITicketsContainerProps) => {
  const {
    response,
    rows,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    searchTerm,
    onSearch,
    refresh,
    setData,
    onRowClick
  } = props;

  const api = useApi();
  const dialogContext = useDialogContext();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ITicket | undefined>();

  // Close the delete confirmation dialog.
  const closeDeleteTicketDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  // Delete a ticket and refresh the current server-backed list.
  const deleteTicket = useCallback(
    async (ticket: ITicket) => {
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
        const apiError = caughtError as APIError;
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: apiError.message
        });
      }
    },
    [api.tickets, dialogContext, refresh]
  );

  // Open the delete confirmation dialog and wire confirmation action.
  const handleDeleteTicket = useCallback(
    (ticket: ITicket) => {
      const handleConfirmDelete = () => {
        deleteTicket(ticket);
        closeDeleteTicketDialog();
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
    [closeDeleteTicketDialog, deleteTicket, dialogContext]
  );

  // Optimistically toggle ticket status, then reconcile with API response.
  const handleToggleTicketStatus = useCallback(
    async (ticket: ITicket, nextStatus: TicketStatus) => {
      const optimisticRows = rows.map((existingTicket) =>
        existingTicket.ticket_id === ticket.ticket_id ? { ...existingTicket, status: nextStatus } : existingTicket
      );
      const previousTicket = rows.find((existingTicket) => existingTicket.ticket_id === ticket.ticket_id);

      if (!response) {
        return;
      }

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

        const apiError = caughtError as APIError;
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: apiError.message
        });
      }
    },
    [api.tickets, dialogContext, response, rows, setData]
  );

  // Create a ticket and append it to the current response for optimistic UX.
  const handleCreateTicket = async (values: ITicketFormValues) => {
    try {
      setIsSubmitting(true);
      const createdTicket = await api.tickets.createTicket(values);

      if (!response) {
        return;
      }

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
      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit dialog for the selected ticket.
  const handleEditTicket = useCallback((ticket: ITicket) => {
    setSelectedTicket(ticket);
    setIsEditDialogOpen(true);
  }, []);

  // Persist edited ticket, then merge API result into the current response payload.
  const handleEditTicketSave = async (payload: IUpdateTicketRequest) => {
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
      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsEditingTicket(false);
    }
  };

  const columns: GridColDef<ITicket>[] = useMemo(
    () => [
      {
        field: 'ticket_slug',
        headerName: 'Ticket ID',
        minWidth: 130,
        flex: 0.8,
        sortable: false,
        renderCell: (params) => <Typography variant="body2">#{params.value}</Typography>
      },
      {
        field: 'subject',
        headerName: 'Subject',
        minWidth: 280,
        flex: 2,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {params.value}
          </Typography>
        )
      },
      {
        field: 'priority',
        headerName: 'Priority',
        minWidth: 30,
        flex: 0.9,
        sortable: false,
        renderCell: (params) => <Typography variant="body2">{params.value}</Typography>
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 140,
        flex: 0.8,
        sortable: false,
        renderCell: (params) => (
          <Chip
            label={params.value}
            size="small"
            color={params.value === 'open' ? 'success' : 'default'}
            sx={{ fontWeight: 700, textTransform: 'capitalize' }}
          />
        )
      },
      {
        field: 'create_date',
        headerName: 'Created',
        minWidth: 140,
        flex: 1,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {getRelativeTimeLabel(typeof params.value === 'string' ? params.value : undefined)}
          </Typography>
        )
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 100,
        flex: 0.6,
        sortable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <CustomMenuIconButton
              buttonTitle="Actions"
              buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
              menuItems={[
                {
                  menuIcon: <Icon path={mdiPencil} size={0.875} />,
                  menuLabel: 'Edit ticket',
                  menuOnClick: () => handleEditTicket(params.row)
                },
                {
                  menuIcon: <Icon path={params.row.status === 'open' ? mdiClose : mdiRefresh} size={0.875} />,
                  menuLabel: params.row.status === 'open' ? 'Close ticket' : 'Reopen ticket',
                  menuOnClick: () =>
                    handleToggleTicketStatus(params.row, params.row.status === 'open' ? 'closed' : 'open')
                },
                {
                  menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                  menuLabel: 'Remove ticket',
                  menuOnClick: () => handleDeleteTicket(params.row)
                }
              ]}
            />
          </Box>
        )
      }
    ],
    [handleDeleteTicket, handleEditTicket, handleToggleTicketStatus]
  );

  return (
    <>
      <PageSection
        id="tickets"
        label={
          <>
            Tickets{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setIsCreateDialogOpen(true)}
        addLabel="New Ticket"
        headerContent={
          <Stack gap={1} direction="row" alignItems="center">
            <TextField
              size="small"
              placeholder="Search by ticket subject"
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon path={mdiMagnify} size={0.875} />
                    </InputAdornment>
                  )
                }
              }}
              sx={{ width: 250 }}
            />
          </Stack>
        }>
        <ServerPaginatedDataGrid<ITicket>
          dataTestId="tickets-table"
          rows={rows}
          columns={columns}
          getRowId={(row) => row.ticket_id}
          noRowsMessage="No tickets"
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={setPaginationModel}
          sortModel={sortModel}
          setSortModel={setSortModel}
          onRowClick={(row) => onRowClick(row.ticket_id)}
        />
      </PageSection>

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
