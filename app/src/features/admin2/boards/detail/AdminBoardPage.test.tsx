import { useApi } from 'hooks/useApi';
import { IBoardDetail } from 'interfaces/useBoardsApi.interface';
import { ITicketWithTags } from 'interfaces/useTicketsApi.interface';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { AdminBoardPage } from './AdminBoardPage';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));

const boardId = '11111111-1111-4111-8111-111111111111';
const urgentTag = { tag_id: 'tag-1', name: 'Urgent', color: '#D8292F' };

const board: IBoardDetail = {
  board_id: boardId,
  name: 'Triage',
  description: 'Tickets that need a first look',
  create_date: '2026-10-01T00:00:00.000Z',
  tags: [{ board_tag_id: 'board-tag-1', ...urgentTag }]
};

const ticket: ITicketWithTags = {
  ticket_id: 'ticket-1',
  ticket_slug: '04900001',
  subject: 'Board ticket',
  description: null,
  team_id: 'team-1',
  create_date: '2026-10-01T00:00:00.000Z',
  priority: 'high',
  status: 'open',
  tags: [urgentTag]
};

const TicketRoute = () => {
  const { ticketId } = useParams();
  return <div data-testid="ticket-page">{ticketId}</div>;
};

/**
 * Renders the board page at the board's route, beside the ticket route its rows open.
 *
 * @param {string} [search] The query string, such as `?tab=tags`.
 * @returns The RTL render result.
 */
const renderBoardPage = (search = '') =>
  render(
    <MemoryRouter initialEntries={[`/admin/tickets/boards/${boardId}${search}`]}>
      <Routes>
        <Route path="/admin/tickets/boards/:boardId" element={<AdminBoardPage />} />
        <Route path="/admin/tickets/:ticketId" element={<TicketRoute />} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminBoardPage', () => {
  const getBoard = vi.fn();
  const getTicketsForAdmin = vi.fn();
  const getTags = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getBoard.mockResolvedValue(board);
    getTicketsForAdmin.mockResolvedValue({
      tickets: [ticket],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
    getTags.mockResolvedValue({
      tags: [{ ...urgentTag, description: 'Needs attention today', create_date: '2026-10-01T00:00:00.000Z' }],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
    (useApi as Mock).mockReturnValue({
      boards: { getBoard },
      tickets: { getTicketsForAdmin },
      tags: { getTags }
    });
  });

  it('shows the board with Tickets and Tags tabs and no closed toggle or settings', async () => {
    renderBoardPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Triage' })).toBeVisible();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Tickets', 'Tags']);
    expect(screen.getByRole('tab', { name: 'Tickets' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Boards' })).toHaveAttribute('href', '/admin/tickets?tab=boards');
    expect(screen.getByRole('button', { name: 'Edit Board' })).toBeVisible();
    expect(screen.queryByRole('switch', { name: 'Include closed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it("lists the board's tickets by board_id and opens a ticket's page from its row", async () => {
    renderBoardPage();

    fireEvent.click(await screen.findByText('Board ticket'));

    expect(getTicketsForAdmin).toHaveBeenCalledWith(
      { search: '', page: 1, limit: 10, sort: 'create_date', order: 'desc', board_id: boardId },
      { signal: expect.any(AbortSignal) }
    );
    expect(await screen.findByTestId('ticket-page')).toHaveTextContent('ticket-1');
  });

  it("lists one page of the board's tags by board_id on the Tags tab", async () => {
    renderBoardPage();
    await screen.findByText('Board ticket');

    fireEvent.click(screen.getByRole('tab', { name: 'Tags' }));

    expect(await screen.findByText('Needs attention today')).toBeVisible();
    await waitFor(() =>
      expect(getTags).toHaveBeenCalledWith(
        { board_id: boardId, page: 1, limit: 10, sort: 'name', order: 'asc' },
        { signal: expect.any(AbortSignal) }
      )
    );
    expect(screen.queryByText('Board ticket')).not.toBeInTheDocument();
  });
});
