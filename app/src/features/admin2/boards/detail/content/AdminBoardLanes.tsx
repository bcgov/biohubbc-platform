import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { IBoardTicketsResponse } from 'interfaces/useBoardsApi.interface';
import { pluralize } from 'utils/Utils';
import { AdminBoardLane } from './AdminBoardLane';

interface IAdminBoardLanesProps {
  boardTickets: IBoardTicketsResponse;
}

/**
 * A board's lanes as columns, left to right: "Unsorted" first, then each visible lane in order. Many lanes scroll
 * horizontally. A note counts the tickets that only hidden lanes hold.
 *
 * @param {IAdminBoardLanesProps} props The board's tickets grouped by lane.
 * @returns {JSX.Element} The board columns.
 */
export const AdminBoardLanes = (props: IAdminBoardLanesProps) => {
  const { boardTickets } = props;
  const hiddenTicketCount = boardTickets.hidden_ticket_count;
  const hiddenTicketLabel = `${hiddenTicketCount} ${pluralize(hiddenTicketCount, 'ticket')}`;

  return (
    <Stack gap={2}>
      {hiddenTicketCount > 0 ? (
        <Alert severity="info" data-testid="board-hidden-ticket-count">
          {hiddenTicketLabel} in hidden lanes
        </Alert>
      ) : null}
      <Stack direction="row" gap={2} alignItems="flex-start" sx={{ overflowX: 'auto', pb: 1 }}>
        <AdminBoardLane id="unsorted" name="Unsorted" color={null} tickets={boardTickets.unsorted} />
        {boardTickets.swimlanes.map((swimlane) => (
          <AdminBoardLane
            key={swimlane.board_swimlane_id}
            id={swimlane.board_swimlane_id}
            name={swimlane.name}
            color={swimlane.color}
            tickets={swimlane.tickets}
          />
        ))}
      </Stack>
    </Stack>
  );
};
