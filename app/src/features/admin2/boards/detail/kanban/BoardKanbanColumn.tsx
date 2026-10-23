import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ITicketWithTags } from 'interfaces/useTicketsApi.interface';
import { DragEvent, Fragment } from 'react';
import { BoardTicketCard } from './BoardTicketCard';

interface IBoardKanbanColumnProps {
  /** The lane's name. */
  label: string;
  /** Hex color, `#RRGGBB`, shown beside the name; null for none. */
  color: string | null;
  tickets: ITicketWithTags[];
  /** Where a card dragged over the column would be dropped, among its cards; undefined when none would be. */
  dropIndex: number | undefined;
  /** Opens a ticket's page. */
  onTicketClick: (ticketId: string) => void;
  /** Starts dragging one of the column's cards. */
  onTicketDragStart: (ticket: ITicketWithTags) => void;
  onTicketDragEnd: () => void;
  /** Takes one of the column's tickets off the board. */
  onTicketRemove: (ticket: ITicketWithTags) => void;
  /**
   * Called while a card is dragged over the column with where among its cards it would be dropped; returns whether it
   * can be dropped there. Omitted for a column cards cannot be dropped in.
   */
  onDragOver?: (index: number) => boolean;
  onDragLeave?: () => void;
  /** Drops the dragged card where among the column's cards it is dropped. */
  onDrop?: (index: number) => void;
}

/**
 * Where among a column's cards a card dragged to a height would be dropped: before the first card whose middle is below
 * that height, or else last.
 *
 * @param {DragEvent<HTMLElement>} event The drag event over the column.
 * @returns {number} The zero-based index among the column's cards.
 */
const getDropIndex = (event: DragEvent<HTMLElement>) => {
  const cards = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-testid="board-ticket-card"]'));
  const index = cards.findIndex((card) => {
    const rect = card.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  });

  return index === -1 ? cards.length : index;
};

/**
 * One column of a board's kanban: its name, color and ticket count above its ticket cards. Its cards can be dragged
 * out, and, given drop handlers, cards can be dropped in at a position, which a line marks while dragging.
 *
 * @param {IBoardKanbanColumnProps} props The column's name, color and tickets, and the click and drag handlers.
 * @returns {JSX.Element} The kanban column.
 */
export const BoardKanbanColumn = (props: IBoardKanbanColumnProps) => {
  const {
    label,
    color,
    tickets,
    dropIndex,
    onTicketClick,
    onTicketDragStart,
    onTicketDragEnd,
    onTicketRemove,
    onDragOver,
    onDragLeave,
    onDrop
  } = props;
  const isDropTarget = dropIndex !== undefined;
  const dropLine = <Box data-testid="board-drop-line" sx={{ height: 3, borderRadius: 1, bgcolor: 'primary.main' }} />;

  return (
    <Box
      component="section"
      aria-label={label}
      onDragOver={(event) => {
        if (onDragOver?.(getDropIndex(event))) {
          event.preventDefault();
        }
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop?.(getDropIndex(event));
      }}
      sx={{
        flex: '0 0 300px',
        borderRadius: 1,
        backgroundColor: isDropTarget ? 'action.hover' : 'grey.50',
        outline: isDropTarget ? 2 : 0,
        outlineColor: 'primary.main',
        p: 1.5
      }}>
      <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
        {color && <Box sx={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, backgroundColor: color }} />}
        <Typography variant="body2" fontWeight={700} noWrap title={label}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {tickets.length}
        </Typography>
      </Stack>
      <Stack gap={1} sx={{ minHeight: 48 }}>
        {tickets.map((ticket, index) => (
          <Fragment key={ticket.ticket_id}>
            {dropIndex === index && dropLine}
            <BoardTicketCard
              ticket={ticket}
              onClick={onTicketClick}
              onDragStart={() => onTicketDragStart(ticket)}
              onDragEnd={onTicketDragEnd}
              onRemove={onTicketRemove}
            />
          </Fragment>
        ))}
        {dropIndex === tickets.length && dropLine}
      </Stack>
    </Box>
  );
};
