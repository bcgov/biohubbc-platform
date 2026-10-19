import { useApi } from 'hooks/useApi';
import { IBoardTicketsResponse } from 'interfaces/useBoardsApi.interface';
import { ITicketWithTags } from 'interfaces/useTicketsApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { AdminBoardPage } from './AdminBoardPage';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));

const boardId = '11111111-1111-4111-8111-111111111111';

/**
 * Builds a board ticket.
 *
 * @param {string} ticketId The ticket id.
 * @param {string} subject The ticket subject.
 * @returns {ITicketWithTags} The ticket.
 */
const makeTicket = (ticketId: string, subject: string): ITicketWithTags => ({
  ticket_id: ticketId,
  ticket_slug: '04900001',
  subject,
  description: null,
  team_id: 'team-1',
  create_date: '2026-10-01T00:00:00.000Z',
  priority: 'high',
  status: 'open',
  tags: [{ tag_id: 'tag-1', name: 'Urgent', color: '#D8292F' }]
});

const boardTickets: IBoardTicketsResponse = {
  board: { board_id: boardId, name: 'Triage', description: null, color: '#1A5A96', create_date: '2026-10-01' },
  unsorted: [makeTicket('ticket-1', 'Unsorted ticket')],
  swimlanes: [
    { board_swimlane_id: 'lane-1', name: 'Blocked', color: '#FCBA19', sort_order: 0, tickets: [] },
    {
      board_swimlane_id: 'lane-2',
      name: 'In review',
      color: null,
      sort_order: 1,
      tickets: [makeTicket('ticket-2', 'Review ticket')]
    }
  ],
  hidden_ticket_count: 3
};

/**
 * Renders the board page at the board's route.
 *
 * @returns The RTL render result.
 */
const renderBoardPage = () =>
  render(
    <MemoryRouter initialEntries={[`/admin/boards/${boardId}`]}>
      <Routes>
        <Route path="/admin/boards/:boardId" element={<AdminBoardPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminBoardPage', () => {
  const getBoardTickets = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getBoardTickets.mockResolvedValue(boardTickets);
    (useApi as Mock).mockReturnValue({ boards: { getBoardTickets } });
  });

  it('shows Unsorted first, then each lane in order, with the hidden lane ticket count', async () => {
    renderBoardPage();

    expect(await screen.findByTestId('board-lane-unsorted')).toBeVisible();
    const laneIds = screen.getAllByTestId(/^board-lane-/).map((lane) => lane.getAttribute('data-testid'));
    expect(laneIds).toEqual(['board-lane-unsorted', 'board-lane-lane-1', 'board-lane-lane-2']);
    expect(within(screen.getByTestId('board-lane-unsorted')).getByText('Unsorted ticket')).toBeVisible();
    expect(within(screen.getByTestId('board-lane-lane-1')).getByText('No tickets')).toBeVisible();
    expect(within(screen.getByTestId('board-lane-lane-2')).getByText('Review ticket')).toBeVisible();
    expect(screen.getByTestId('board-hidden-ticket-count')).toHaveTextContent('3 tickets in hidden lanes');
    expect(getBoardTickets).toHaveBeenCalledWith(boardId, { include_closed: false }, expect.anything());
  });

  it('links each ticket card to its administrative ticket page', async () => {
    renderBoardPage();

    const card = await screen.findByTestId('board-ticket-ticket-2');
    expect(within(card).getByRole('link')).toHaveAttribute('href', '/admin/tickets/ticket-2');
    expect(within(card).getByText('Urgent')).toBeVisible();
  });

  it('omits the hidden lane note when no tickets are only in hidden lanes', async () => {
    getBoardTickets.mockResolvedValue({ ...boardTickets, hidden_ticket_count: 0 });
    renderBoardPage();

    await screen.findByTestId('board-lane-unsorted');
    expect(screen.queryByTestId('board-hidden-ticket-count')).not.toBeInTheDocument();
  });

  it('reloads the board with closed tickets when "Include closed" is switched on', async () => {
    renderBoardPage();
    await screen.findByTestId('board-lane-unsorted');

    fireEvent.click(screen.getByRole('switch', { name: 'Include closed' }));

    await waitFor(() =>
      expect(getBoardTickets).toHaveBeenLastCalledWith(boardId, { include_closed: true }, expect.anything())
    );
    expect(screen.getByTestId('board-lane-unsorted')).toBeVisible();
  });
});
