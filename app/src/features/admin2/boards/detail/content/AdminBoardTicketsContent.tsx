import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IBoardTickets, IBoardTicketSwimlane } from 'interfaces/useBoardsApi.interface';
import { ITicketWithTags } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { BoardTicketAddDialog } from '../../dialog/BoardTicketAddDialog';
import { CreateTicketDialog } from 'features/admin/tickets/components/dialog/create/CreateTicketDialog';
import { ITicketFormValues } from 'features/admin/tickets/components/dialog/form/TicketForm';
import { BoardKanbanColumn } from '../kanban/BoardKanbanColumn';

/** A card dropped in a lane, at a position among the lane's other cards. */
interface IBoardTicketMove {
  ticket: ITicketWithTags;
  toBoardSwimlaneId: string;
  position: number;
}

/** Where a dragged card would be dropped: a lane, and an index among the cards it shows. */
interface IDropTarget {
  boardSwimlaneId: string;
  index: number;
}

interface IAdminBoardTicketsContentProps {
  /** The board whose tickets are shown. */
  boardId: string;
}

/**
 * Tickets tab of a board's page: the board's open tickets as a kanban, a column per lane with its tickets in their order
 * there. Each ticket is in exactly one lane. Each card opens its ticket, and its menu takes the ticket off the board. A
 * board without lanes says so.
 *
 * A card can be dragged to a position in any lane, its own included, which a line marks while dragging. The card moves
 * at once and moves back if the move fails. A ticket's tags are not affected by its lane.
 *
 * New Ticket creates a ticket on the board, and Add Tickets puts existing tickets on it; both go last in the board's
 * default lane, To Do, and can then be dragged elsewhere.
 *
 * @param {IAdminBoardTicketsContentProps} props The board whose tickets are shown.
 * @returns {JSX.Element} The board's tickets section and its dialogs.
 */
export const AdminBoardTicketsContent = (props: IAdminBoardTicketsContentProps) => {
  const { boardId } = props;
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const [draggedTicket, setDraggedTicket] = useState<ITicketWithTags | undefined>();
  const [dropTarget, setDropTarget] = useState<IDropTarget | undefined>();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const boardTicketsQueryKey = ticketQueryKeys.boardList(boardId);
  const boardTicketsQuery = useQuery({
    queryKey: boardTicketsQueryKey,
    queryFn: ({ signal }) => api.boards.getBoardTickets(boardId, { signal })
  });

  const moveTicketMutation = useMutation({
    mutationFn: ({ ticket, toBoardSwimlaneId, position }: IBoardTicketMove) =>
      api.boards.updateBoardTicket(boardId, ticket.ticket_id, { boardSwimlaneId: toBoardSwimlaneId, position }),
    onMutate: async ({ ticket, toBoardSwimlaneId, position }) => {
      await queryClient.cancelQueries({ queryKey: boardTicketsQueryKey });
      const previous = queryClient.getQueryData<IBoardTickets>(boardTicketsQueryKey);
      queryClient.setQueryData<IBoardTickets>(
        boardTicketsQueryKey,
        (current) =>
          current && {
            ...current,
            swimlanes: current.swimlanes.map((swimlane) => {
              const otherTickets = swimlane.tickets.filter((row) => row.ticket_id !== ticket.ticket_id);
              if (swimlane.board_swimlane_id === toBoardSwimlaneId) {
                const movedTickets = [...otherTickets.slice(0, position), ticket, ...otherTickets.slice(position)];
                return { ...swimlane, tickets: movedTickets };
              }
              return { ...swimlane, tickets: otherTickets };
            })
          }
      );
      return { previous };
    },
    onError: (error: Error, _move, context) => {
      queryClient.setQueryData<IBoardTickets>(boardTicketsQueryKey, context?.previous);
      dialogContext.setSnackbar({ open: true, snackbarMessage: error.message });
    },
    onSettled: () => refreshChangedQueries(queryClient, changedQueryKeys.boardTicket())
  });

  const removeTicketMutation = useMutation({
    mutationFn: (ticket: ITicketWithTags) => api.boards.deleteBoardTicket(boardId, ticket.ticket_id),
    onSuccess: (_data, ticket) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: `Removed ticket #${ticket.ticket_slug} from the board`
      });
    },
    onError: (error: Error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message }),
    onSettled: () => refreshChangedQueries(queryClient, changedQueryKeys.boardTicket())
  });

  const createTicketMutation = useMutation({
    mutationFn: (values: ITicketFormValues) =>
      api.boards.createBoardTicket(boardId, {
        subject: values.subject.trim(),
        description: values.description?.trim() || null,
        priority: values.priority
      }),
    onSuccess: (createdTicket) => {
      dialogContext.setSnackbar({ open: true, snackbarMessage: `Created ticket #${createdTicket.ticket_slug}` });
      closeCreateDialog();
      void refreshChangedQueries(queryClient, changedQueryKeys.ticketLists());
    },
    onError: (error: Error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });

  /**
   * Closes the create dialog and forgets its last error.
   *
   * @returns {void}
   */
  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    createTicketMutation.reset();
  };

  /**
   * Asks for confirmation before taking a ticket off the board. The ticket itself is not affected.
   *
   * @param {ITicketWithTags} ticket The ticket to take off the board.
   * @returns {void}
   */
  const handleRemoveTicket = (ticket: ITicketWithTags) => {
    const closeConfirmation = () => dialogContext.setYesNoDialog({ open: false });

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Remove ticket from board?',
      dialogContent: (
        <Typography component="div" color="textSecondary">
          Ticket <strong>#{ticket.ticket_slug}</strong> is taken off this board. The ticket itself is not affected.
        </Typography>
      ),
      yesButtonLabel: 'Remove',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: closeConfirmation,
      onNo: closeConfirmation,
      onYes: () => {
        closeConfirmation();
        removeTicketMutation.mutate(ticket);
      }
    });
  };

  /**
   * Where the dragged card would go in a lane if dropped before the card at an index: its position among the lane's
   * other cards. Dropping a card just before or after itself would leave it where it is, so that is no position.
   *
   * @param {IBoardTicketSwimlane} swimlane The lane under the card.
   * @param {number} index The index, among the cards the lane shows, the card would be dropped before.
   * @returns {number | undefined} The card's position among the lane's other cards, or undefined if it would not move.
   */
  const getDropPosition = (swimlane: IBoardTicketSwimlane, index: number): number | undefined => {
    if (!draggedTicket) {
      return undefined;
    }

    const currentIndex = swimlane.tickets.findIndex((ticket) => ticket.ticket_id === draggedTicket.ticket_id);

    if (currentIndex === -1) {
      return index;
    }

    if (index === currentIndex || index === currentIndex + 1) {
      return undefined;
    }

    return index > currentIndex ? index - 1 : index;
  };

  /**
   * Marks where the dragged card would be dropped in a lane, if it would move there.
   *
   * @param {IBoardTicketSwimlane} swimlane The lane under the card.
   * @param {number} index The index, among the cards the lane shows, the card would be dropped before.
   * @returns {boolean} Whether the card can be dropped there.
   */
  const handleSwimlaneDragOver = (swimlane: IBoardTicketSwimlane, index: number) => {
    const canDrop = getDropPosition(swimlane, index) !== undefined;
    setDropTarget(canDrop ? { boardSwimlaneId: swimlane.board_swimlane_id, index } : undefined);
    return canDrop;
  };

  /**
   * Ends the drag, clearing the dragged card and the marked drop position.
   *
   * @returns {void}
   */
  const endDrag = () => {
    setDraggedTicket(undefined);
    setDropTarget(undefined);
  };

  /**
   * Moves the dragged card to where it is dropped in a lane.
   *
   * @param {IBoardTicketSwimlane} swimlane The lane the card is dropped in.
   * @param {number} index The index, among the cards the lane shows, the card is dropped before.
   * @returns {void}
   */
  const handleSwimlaneDrop = (swimlane: IBoardTicketSwimlane, index: number) => {
    const position = getDropPosition(swimlane, index);

    if (draggedTicket && position !== undefined) {
      moveTicketMutation.mutate({ ticket: draggedTicket, toBoardSwimlaneId: swimlane.board_swimlane_id, position });
    }
    endDrag();
  };

  /**
   * Opens a ticket's page.
   *
   * @param {string} ticketId The ticket.
   * @returns {void}
   */
  const handleTicketClick = (ticketId: string) => navigate(`/admin/tickets/${ticketId}`);

  const boardTickets = boardTicketsQuery.data;

  return (
    <>
      <QueryErrorDialog error={boardTicketsQuery.error} label="board tickets" />
      <PageSection
        id="board-tickets"
        label={
          <>
            Tickets{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({boardTickets?.tickets.length ?? 0})
            </Typography>
          </>
        }
        onAdd={() => setIsCreateDialogOpen(true)}
        addLabel="New Ticket"
        headerContent={
          <Button
            variant="outlined"
            disabled={!boardTickets}
            startIcon={<Icon path={mdiPlus} size={0.8} />}
            onClick={() => setIsAddDialogOpen(true)}>
            Add Tickets
          </Button>
        }>
        <Box sx={{ p: 2 }}>
          {boardTickets && !boardTickets.swimlanes.length && (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No swimlanes
            </Typography>
          )}
          {boardTickets && boardTickets.swimlanes.length > 0 && (
            <Stack direction="row" gap={2} alignItems="flex-start" sx={{ overflowX: 'auto' }}>
              {boardTickets.swimlanes.map((swimlane) => (
                <BoardKanbanColumn
                  key={swimlane.board_swimlane_id}
                  label={swimlane.name}
                  color={swimlane.color}
                  tickets={swimlane.tickets}
                  dropIndex={dropTarget?.boardSwimlaneId === swimlane.board_swimlane_id ? dropTarget.index : undefined}
                  onTicketClick={handleTicketClick}
                  onTicketDragStart={setDraggedTicket}
                  onTicketDragEnd={endDrag}
                  onTicketRemove={handleRemoveTicket}
                  onDragOver={(index) => handleSwimlaneDragOver(swimlane, index)}
                  onDragLeave={() => setDropTarget(undefined)}
                  onDrop={(index) => handleSwimlaneDrop(swimlane, index)}
                />
              ))}
            </Stack>
          )}
          {!boardTickets && (
            <Stack direction="row" gap={2}>
              {[0, 1, 2].map((column) => (
                <Skeleton key={column} variant="rounded" width={300} height={240} />
              ))}
            </Stack>
          )}
        </Box>
      </PageSection>

      <CreateTicketDialog
        open={isCreateDialogOpen}
        isLoading={createTicketMutation.isPending}
        onCancel={closeCreateDialog}
        onSave={(values) => createTicketMutation.mutate(values)}
      />

      {boardTickets && (
        <BoardTicketAddDialog
          open={isAddDialogOpen}
          boardId={boardId}
          boardTickets={boardTickets}
          onClose={() => setIsAddDialogOpen(false)}
        />
      )}
    </>
  );
};
