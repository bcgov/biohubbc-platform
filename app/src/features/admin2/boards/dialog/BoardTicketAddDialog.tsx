import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDebounce from 'hooks/useDebounce';
import { IBoardTickets } from 'interfaces/useBoardsApi.interface';
import { ITicketsQueryParams } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { BoardTicketAddForm, IBoardTicketAddFormValues } from '../form/BoardTicketAddForm';
import { BoardTicketAddYupSchema } from '../form/BoardTicketAddYupSchema';

interface IBoardTicketAddDialogProps {
  open: boolean;
  boardId: string;
  /** The board's tickets, which are not offered again. */
  boardTickets: IBoardTickets;
  onClose: () => void;
}

const BoardTicketAddFormInitialValues: IBoardTicketAddFormValues = {
  ticketIds: []
};

/**
 * Dialog for putting existing tickets on a board: search the tickets that are not on the board and pick some. Saving
 * puts each in the board's default lane, To Do; the dialog closes on success and stays open on failure, which is
 * reported.
 *
 * @param {IBoardTicketAddDialogProps} props The board, its tickets, and the close handler.
 * @returns {JSX.Element} The add tickets dialog.
 */
export const BoardTicketAddDialog = (props: IBoardTicketAddDialogProps) => {
  const { open, boardId, boardTickets, onClose } = props;
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const [ticketSearch, setTicketSearch] = useState('');

  const ticketOptionsParams: ITicketsQueryParams = {
    search: ticketSearch || undefined,
    page: 1,
    limit: 50,
    sort: 'create_date',
    order: 'desc'
  };
  const ticketOptionsQuery = useQuery({
    queryKey: ticketQueryKeys.list('admin', ticketOptionsParams),
    queryFn: ({ signal }) => api.tickets.getTicketsForAdmin(ticketOptionsParams, { signal }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const handleTicketSearch = useDebounce(setTicketSearch, 300);

  const addTicketsMutation = useMutation({
    mutationFn: ({ ticketIds }: IBoardTicketAddFormValues) =>
      Promise.all(ticketIds.map((ticketId) => api.boards.updateBoardTicket(boardId, ticketId, {}))),
    onSuccess: (_data, { ticketIds }) => {
      setSnackbar({
        open: true,
        snackbarMessage: ticketIds.length === 1 ? 'Added 1 ticket to the board' : `Added ${ticketIds.length} tickets`
      });
      onClose();
    },
    onError: (error: Error) => setSnackbar({ open: true, snackbarMessage: error.message }),
    onSettled: () => refreshChangedQueries(queryClient, changedQueryKeys.boardTicket())
  });

  const boardTicketIds = new Set(boardTickets.tickets.map((ticket) => ticket.ticket_id));
  const ticketOptions: ICustomMultiAutocompleteOption[] = (ticketOptionsQuery.data?.tickets ?? [])
    .filter((ticket) => !boardTicketIds.has(ticket.ticket_id))
    .map((ticket) => ({ value: ticket.ticket_id, label: `#${ticket.ticket_slug} ${ticket.subject}` }));
  return (
    <EditDialog<IBoardTicketAddFormValues>
      open={open}
      dialogTitle="Add Tickets"
      dialogSaveButtonLabel="Add"
      isLoading={addTicketsMutation.isPending}
      component={{
        element: <BoardTicketAddForm ticketOptions={ticketOptions} onTicketSearch={handleTicketSearch} />,
        initialValues: BoardTicketAddFormInitialValues,
        validationSchema: BoardTicketAddYupSchema
      }}
      onCancel={onClose}
      onSave={(values) => addTicketsMutation.mutate(values)}
    />
  );
};
