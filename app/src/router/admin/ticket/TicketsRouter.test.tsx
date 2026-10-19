import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { TicketsRouter } from './TicketsRouter';

vi.mock('utils/RouteWithMeta', () => ({
  PageTitle: () => null
}));

vi.mock('contexts/ticketContext', () => ({
  AdminTicketContextProvider: ({ children }: { children: unknown }) => <>{children}</>
}));

vi.mock('features/admin2/tickets/AdminTicketsPage', () => ({
  AdminTicketsPage: () => <div data-testid="tickets-page" />
}));

vi.mock('features/admin2/boards/detail/AdminBoardPage', () => ({
  AdminBoardPage: () => {
    const { boardId } = useParams();
    return <div data-testid="board-page">{boardId}</div>;
  }
}));

vi.mock('features/admin/tickets/TicketDetailPage', () => ({
  TicketDetailPage: () => {
    const { ticketId } = useParams();
    return <div data-testid="ticket-detail-page">{ticketId}</div>;
  }
}));

/**
 * Renders the tickets router under `/admin/tickets` at a path.
 *
 * @param {string} path The path to open.
 * @returns The RTL render result.
 */
const renderTicketsRouter = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/tickets/*" element={<TicketsRouter />} />
        <Route path="/page-not-found" element={<div data-testid="not-found-page" />} />
      </Routes>
    </MemoryRouter>
  );

describe('TicketsRouter', () => {
  it('renders the tickets page with its tabs', async () => {
    const page = renderTicketsRouter('/admin/tickets?tab=boards');

    expect(await page.findByTestId('tickets-page')).toBeVisible();
  });

  it('renders the board page at a board route rather than reading "boards" as a ticket id', async () => {
    const page = renderTicketsRouter('/admin/tickets/boards/board-1');

    expect(await page.findByTestId('board-page')).toHaveTextContent('board-1');
    expect(page.queryByTestId('ticket-detail-page')).not.toBeInTheDocument();
  });

  it('still renders the ticket detail page at a ticket route', async () => {
    const page = renderTicketsRouter('/admin/tickets/ticket-1');

    expect(await page.findByTestId('ticket-detail-page')).toHaveTextContent('ticket-1');
    expect(page.queryByTestId('board-page')).not.toBeInTheDocument();
  });

  it('no longer routes a board settings page', async () => {
    const page = renderTicketsRouter('/admin/tickets/boards/board-1/settings');

    expect(await page.findByTestId('not-found-page')).toBeVisible();
  });
});
