import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IBoardDetail, IBoardSwimlane, IBoardTickets } from 'interfaces/useBoardsApi.interface';
import { ITicketWithTags } from 'interfaces/useTicketsApi.interface';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { act, createEvent, fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { AdminBoardPage } from './AdminBoardPage';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: vi.fn() }));

const boardId = '11111111-1111-4111-8111-111111111111';
const urgentTag = { tag_id: 'tag-1', name: 'Urgent', color: '#D8292F' };

const doingSwimlane: IBoardSwimlane = {
  board_swimlane_id: '22222222-2222-4222-8222-222222222222',
  board_id: boardId,
  name: 'Doing',
  description: 'Being worked on',
  color: null,
  sort_order: 0
};

const doneSwimlane: IBoardSwimlane = {
  board_swimlane_id: '33333333-3333-4333-8333-333333333333',
  board_id: boardId,
  name: 'Done',
  description: null,
  color: null,
  sort_order: 1
};

const board: IBoardDetail = {
  board_id: boardId,
  name: 'Triage',
  description: 'Tickets that need a first look',
  default_swimlane_id: '22222222-2222-4222-8222-222222222222',
  create_date: '2026-10-01T00:00:00.000Z',
  swimlanes: [doingSwimlane, doneSwimlane]
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

const doneTicket: ITicketWithTags = {
  ...ticket,
  ticket_id: 'ticket-2',
  ticket_slug: '04900002',
  subject: 'Done ticket'
};

// Each ticket is in one lane: the board ticket in Doing, the done ticket in Done.
const boardTickets: IBoardTickets = {
  board: {
    board_id: boardId,
    name: 'Triage',
    description: null,
    default_swimlane_id: '22222222-2222-4222-8222-222222222222',
    create_date: '2026-10-01T00:00:00.000Z'
  },
  tickets: [ticket, doneTicket],
  swimlanes: [
    { ...doingSwimlane, tickets: [ticket] },
    { ...doneSwimlane, tickets: [doneTicket] }
  ]
};

const TicketRoute = () => {
  const { ticketId } = useParams();
  return <div data-testid="ticket-page">{ticketId}</div>;
};

/**
 * Renders the board page at the board's route, beside the ticket route its rows open.
 *
 * @param {string} [search] The query string, such as `?tab=swimlanes`.
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
  const getBoardTickets = vi.fn();
  const getBoardSwimlanes = vi.fn();
  const updateBoardTicket = vi.fn();
  const deleteBoardTicket = vi.fn();
  const createBoardTicket = vi.fn();
  const createBoardSwimlane = vi.fn();
  const updateBoardSwimlane = vi.fn();
  const deleteBoardSwimlane = vi.fn();
  const getTicketsForAdmin = vi.fn();
  const getTags = vi.fn();
  const createBoardTag = vi.fn();
  const addBoardTag = vi.fn();
  const deleteBoardTag = vi.fn();
  const setYesNoDialog = vi.fn();
  const setSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getBoard.mockResolvedValue(board);
    getBoardSwimlanes.mockResolvedValue({
      swimlanes: [doingSwimlane, doneSwimlane],
      pagination: { total: 2, current_page: 1, last_page: 1, per_page: 10 }
    });
    getBoardTickets.mockResolvedValue(boardTickets);
    getTags.mockResolvedValue({
      tags: [{ ...urgentTag, description: 'Needs attention today', create_date: '2026-10-01T00:00:00.000Z' }],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
    (useDialogContext as Mock).mockReturnValue({ setYesNoDialog, setSnackbar });
    (useApi as Mock).mockReturnValue({
      boards: {
        getBoard,
        getBoardTickets,
        getBoardSwimlanes,
        updateBoardTicket,
        deleteBoardTicket,
        createBoardTicket,
        createBoardSwimlane,
        updateBoardSwimlane,
        deleteBoardSwimlane,
        createBoardTag,
        addBoardTag,
        deleteBoardTag
      },
      tickets: { getTicketsForAdmin },
      tags: { getTags }
    });
  });

  it('shows the board with Tickets, Swimlanes and Tags tabs and no closed toggle or settings', async () => {
    renderBoardPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Triage' })).toBeVisible();
    const pageTabs = within(screen.getByRole('tablist', { name: 'administrative tabs' }));
    expect(pageTabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Tickets', 'Swimlanes', 'Tags']);
    expect(pageTabs.getByRole('tab', { name: 'Tickets' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Boards' })).toHaveAttribute('href', '/admin/tickets?tab=boards');
    expect(screen.getByRole('button', { name: 'Edit Board' })).toBeVisible();
    expect(screen.queryByRole('switch', { name: 'Include closed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('shows a kanban of the lanes, with no All column, and opens a ticket from its card', async () => {
    renderBoardPage();

    const doneColumn = within(await screen.findByRole('region', { name: 'Done' }));
    expect(within(screen.getByRole('region', { name: 'Doing' })).getByText('Board ticket')).toBeVisible();
    expect(doneColumn.getByText('Done ticket')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'All' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Tickets (2)' })).toBeVisible();
    expect(getBoardTickets).toHaveBeenCalledWith(boardId, { signal: expect.any(AbortSignal) });

    fireEvent.click(doneColumn.getByText('Done ticket'));

    expect(await screen.findByTestId('ticket-page')).toHaveTextContent('ticket-2');
  });

  describe('dragging a card into a lane', () => {
    /**
     * Fires a drag event at a height. The test DOM lays nothing out, so every card's middle is at 0: a height below 0
     * drops before the first card, and one above it after the last.
     *
     * @param {HTMLElement} target The element the event is fired at.
     * @param {'dragOver' | 'drop'} type The drag event.
     * @param {number} clientY The pointer's height.
     * @returns {void}
     */
    const fireDragAt = (target: HTMLElement, type: 'dragOver' | 'drop', clientY: number) => {
      const event = createEvent[type](target);
      Object.defineProperty(event, 'clientY', { value: clientY });
      fireEvent(target, event);
    };

    /**
     * Drags a card from one column into another, dropping it last unless dropped at the top.
     *
     * @param {string} fromColumn The column the card is dragged from.
     * @param {string} subject The card's ticket subject.
     * @param {string} toColumn The column the card is dropped in.
     * @param {'top' | 'bottom'} [at] Where among the column's cards the card is dropped.
     * @returns {Promise<void>} Resolves once the card is dropped.
     */
    const dragCard = async (fromColumn: string, subject: string, toColumn: string, at: 'top' | 'bottom' = 'bottom') => {
      const column = within(await screen.findByRole('region', { name: fromColumn }));
      const card = column.getByText(subject).closest('[data-testid="board-ticket-card"]') as HTMLElement;
      const target = screen.getByRole('region', { name: toColumn });
      const clientY = at === 'top' ? -1 : 1;
      fireEvent.dragStart(card);
      fireDragAt(target, 'dragOver', clientY);
      fireDragAt(target, 'drop', clientY);
    };

    it('moves a card from its lane to another, leaving its tags alone', async () => {
      updateBoardTicket.mockReturnValue(new Promise(() => undefined));
      renderBoardPage();

      await dragCard('Doing', 'Board ticket', 'Done');

      await waitFor(() =>
        expect(updateBoardTicket).toHaveBeenCalledWith(boardId, ticket.ticket_id, {
          boardSwimlaneId: doneSwimlane.board_swimlane_id,
          position: 1
        })
      );
      const doneColumn = within(screen.getByRole('region', { name: 'Done' }));
      expect(await doneColumn.findByText('Board ticket')).toBeVisible();
      expect(doneColumn.getAllByText('Urgent')).toHaveLength(2);
      expect(within(screen.getByRole('region', { name: 'Doing' })).queryByText('Board ticket')).not.toBeInTheDocument();
    });

    it('moves a card to the top of another lane, marking where it would go while dragging', async () => {
      updateBoardTicket.mockReturnValue(new Promise(() => undefined));
      renderBoardPage();
      const card = within(await screen.findByRole('region', { name: 'Doing' }))
        .getByText('Board ticket')
        .closest('[data-testid="board-ticket-card"]') as HTMLElement;
      const doneColumn = screen.getByRole('region', { name: 'Done' });

      fireEvent.dragStart(card);
      fireDragAt(doneColumn, 'dragOver', -1);
      expect(within(doneColumn).getByTestId('board-drop-line')).toBeVisible();
      fireDragAt(doneColumn, 'drop', -1);

      await waitFor(() =>
        expect(updateBoardTicket).toHaveBeenCalledWith(boardId, ticket.ticket_id, {
          boardSwimlaneId: doneSwimlane.board_swimlane_id,
          position: 0
        })
      );
      const doneCards = within(screen.getByRole('region', { name: 'Done' })).getAllByTestId('board-ticket-card');
      expect(doneCards.map((doneCard) => doneCard.textContent)).toEqual([
        expect.stringContaining('Board ticket'),
        expect.stringContaining('Done ticket')
      ]);
    });

    it('reorders a card within its own lane', async () => {
      const laneTickets: IBoardTickets = {
        ...boardTickets,
        swimlanes: [
          { ...doingSwimlane, tickets: [ticket, doneTicket] },
          { ...doneSwimlane, tickets: [] }
        ]
      };
      getBoardTickets.mockResolvedValue(laneTickets);
      updateBoardTicket.mockReturnValue(new Promise(() => undefined));
      renderBoardPage();

      await dragCard('Doing', 'Done ticket', 'Doing', 'top');

      await waitFor(() =>
        expect(updateBoardTicket).toHaveBeenCalledWith(boardId, doneTicket.ticket_id, {
          boardSwimlaneId: doingSwimlane.board_swimlane_id,
          position: 0
        })
      );
    });

    it('puts the card back and reports the error when the move fails', async () => {
      updateBoardTicket.mockRejectedValue(new Error('Move failed'));
      renderBoardPage();

      await dragCard('Doing', 'Board ticket', 'Done');

      await waitFor(() => expect(setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Move failed' }));
      expect(within(screen.getByRole('region', { name: 'Doing' })).getByText('Board ticket')).toBeVisible();
    });

    it('does not move a card dropped where it already is', async () => {
      renderBoardPage();

      await dragCard('Done', 'Done ticket', 'Done');

      expect(updateBoardTicket).not.toHaveBeenCalled();
    });
  });

  it('says so when the board has no lanes', async () => {
    getBoardTickets.mockResolvedValue({ ...boardTickets, tickets: [], swimlanes: [] });
    renderBoardPage();

    expect(await screen.findByText('No swimlanes')).toBeVisible();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('takes a ticket off the board from its card menu, after confirmation', async () => {
    deleteBoardTicket.mockResolvedValue(undefined);
    renderBoardPage();
    const doingColumn = within(await screen.findByRole('region', { name: 'Doing' }));

    fireEvent.click(doingColumn.getAllByTestId('custom-menu-icon-Actions')[0]);
    fireEvent.click(await screen.findByText('Remove from board'));
    const confirmation = setYesNoDialog.mock.lastCall![0];
    expect(confirmation.yesButtonLabel).toBe('Remove');
    act(() => confirmation.onYes());

    await waitFor(() => expect(deleteBoardTicket).toHaveBeenCalledWith(boardId, ticket.ticket_id));
  });

  it('creates a ticket on the board without picking a lane', async () => {
    createBoardTicket.mockResolvedValue({ ...ticket, ticket_slug: '04900003' });
    renderBoardPage();
    await screen.findByRole('region', { name: 'Doing' });

    fireEvent.click(screen.getByRole('button', { name: 'New Ticket' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByRole('combobox', { name: /Swimlane/ })).not.toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText(/Subject/), { target: { value: 'Count fish' } });
    fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

    await waitFor(() =>
      expect(createBoardTicket).toHaveBeenCalledWith(boardId, {
        subject: 'Count fish',
        description: null,
        priority: 'medium'
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('puts existing tickets that are not on the board on it, without picking a lane', async () => {
    const otherTicket = { ...ticket, ticket_id: 'ticket-3', ticket_slug: '04900003', subject: 'Other ticket' };
    getTicketsForAdmin.mockResolvedValue({
      tickets: [ticket, otherTicket],
      pagination: { total: 2, current_page: 1, last_page: 1, per_page: 50 }
    });
    updateBoardTicket.mockResolvedValue(undefined);
    renderBoardPage();
    await screen.findByRole('region', { name: 'Doing' });

    fireEvent.click(screen.getByRole('button', { name: 'Add Tickets' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByRole('combobox', { name: /Swimlane/ })).not.toBeInTheDocument();
    fireEvent.mouseDown(dialog.getByRole('combobox', { name: /Tickets/ }));
    expect(await screen.findByRole('option', { name: '#04900003 Other ticket' })).toBeVisible();
    expect(screen.queryByRole('option', { name: '#04900001 Board ticket' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: '#04900003 Other ticket' }));
    fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

    await waitFor(() => expect(updateBoardTicket).toHaveBeenCalledWith(boardId, 'ticket-3', {}));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("lists one page of the board's swimlanes in display order on the Swimlanes tab", async () => {
    renderBoardPage('?tab=swimlanes');

    expect(await screen.findByText('Being worked on')).toBeVisible();
    const rows = within(screen.getByRole('grid')).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('gridcell')[0].textContent)).toEqual(['Doing', 'Done']);
    expect(screen.queryByRole('columnheader', { name: 'Visibility' })).not.toBeInTheDocument();
    expect(getBoardSwimlanes).toHaveBeenCalledWith(
      boardId,
      { page: 1, limit: 10, sort: 'sort_order', order: 'asc' },
      { signal: expect.any(AbortSignal) }
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Swimlanes (2)' })).toBeVisible();
    expect(screen.getByText('1–2 of 2')).toBeVisible();
  });

  it('creates a swimlane from the Swimlanes tab', async () => {
    createBoardSwimlane.mockResolvedValue({ ...doneSwimlane, name: 'Blocked' });
    renderBoardPage('?tab=swimlanes');
    await screen.findByText('Being worked on');

    fireEvent.click(screen.getByRole('button', { name: 'New Swimlane' }));
    expect(within(await screen.findByRole('dialog')).queryByLabelText('Visible')).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText(/Name/), { target: { value: ' Blocked ' } });
    fireEvent.change(screen.getByLabelText(/Sort order/), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

    await waitFor(() =>
      expect(createBoardSwimlane).toHaveBeenCalledWith(boardId, {
        name: 'Blocked',
        description: null,
        color: null,
        sortOrder: 5
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("edits a swimlane's sort order, which the table shows", async () => {
    updateBoardSwimlane.mockResolvedValue({ ...doingSwimlane, sort_order: 2 });
    renderBoardPage('?tab=swimlanes');
    await screen.findByText('Being worked on');
    expect(screen.getByRole('columnheader', { name: 'Sort order' })).toBeVisible();

    fireEvent.click(screen.getAllByTestId('custom-menu-icon-Actions')[0]);
    fireEvent.click(await screen.findByText('Edit swimlane'));
    const sortOrder = await within(await screen.findByRole('dialog')).findByLabelText(/Sort order/);
    expect(sortOrder).toHaveValue('0');
    fireEvent.change(sortOrder, { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

    await waitFor(() =>
      expect(updateBoardSwimlane).toHaveBeenCalledWith(
        boardId,
        doingSwimlane.board_swimlane_id,
        expect.objectContaining({ name: doingSwimlane.name, sortOrder: 2 })
      )
    );
  });

  it('rejects a sort order that is not a whole number', async () => {
    renderBoardPage('?tab=swimlanes');
    await screen.findByText('Being worked on');

    fireEvent.click(screen.getByRole('button', { name: 'New Swimlane' }));
    fireEvent.change(await screen.findByLabelText(/Name/), { target: { value: 'Blocked' } });
    fireEvent.change(screen.getByLabelText(/Sort order/), { target: { value: '1.5' } });
    fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

    expect(await screen.findByText('Sort order must be a whole number, such as 0 or 3')).toBeVisible();
    expect(createBoardSwimlane).not.toHaveBeenCalled();
  });

  it('deletes a swimlane after confirmation, and reports a refusal', async () => {
    deleteBoardSwimlane.mockRejectedValue(new Error("Move or remove the swimlane's tickets before deleting it"));
    renderBoardPage('?tab=swimlanes');
    await screen.findByText('Being worked on');

    fireEvent.click(screen.getAllByTestId('custom-menu-icon-Actions')[0]);
    fireEvent.click(await screen.findByText('Delete swimlane'));
    const confirmation = setYesNoDialog.mock.lastCall![0];
    expect(confirmation.yesButtonLabel).toBe('Delete Swimlane');
    act(() => confirmation.onYes());

    await waitFor(() => expect(deleteBoardSwimlane).toHaveBeenCalledWith(boardId, doingSwimlane.board_swimlane_id));
    await waitFor(() =>
      expect(setSnackbar).toHaveBeenCalledWith({
        open: true,
        snackbarMessage: "Move or remove the swimlane's tickets before deleting it"
      })
    );
  });

  describe('Tags tab', () => {
    it("lists one page of the board's tags by board_id", async () => {
      renderBoardPage('?tab=tags');

      expect(await screen.findByText('Needs attention today')).toBeVisible();
      await waitFor(() =>
        expect(getTags).toHaveBeenCalledWith(
          { board_id: boardId, page: 1, limit: 10, sort: 'name', order: 'asc' },
          { signal: expect.any(AbortSignal) }
        )
      );
      expect(screen.getByText('1–1 of 1')).toBeVisible();
    });

    it('creates a tag linked to the board', async () => {
      createBoardTag.mockResolvedValue({ ...urgentTag, description: null, create_date: '2026-10-01T00:00:00.000Z' });
      renderBoardPage('?tab=tags');
      await screen.findByText('Needs attention today');

      fireEvent.click(screen.getByRole('button', { name: 'New Tag' }));
      fireEvent.change(await screen.findByLabelText(/Name/), { target: { value: ' Blocked ' } });
      fireEvent.change(screen.getByLabelText(/Color/), { target: { value: '#D8292F' } });
      fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

      await waitFor(() =>
        expect(createBoardTag).toHaveBeenCalledWith(boardId, { name: 'Blocked', description: null, color: '#D8292F' })
      );
    });

    it('links existing tags to the board', async () => {
      addBoardTag.mockResolvedValue(undefined);
      renderBoardPage('?tab=tags');
      await screen.findByText('Needs attention today');

      fireEvent.click(screen.getByRole('button', { name: 'Add Tags' }));
      const dialog = within(await screen.findByRole('dialog'));
      fireEvent.mouseDown(dialog.getByRole('combobox', { name: /Tags/ }));
      fireEvent.click(await screen.findByRole('option', { name: 'Urgent' }));
      fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

      await waitFor(() => expect(addBoardTag).toHaveBeenCalledWith(boardId, urgentTag.tag_id));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      // The tag search, pick and save run through several debounced renders; give them more than the default 5s.
    }, 15000);

    it('unlinks a tag from the board after confirmation', async () => {
      deleteBoardTag.mockResolvedValue(undefined);
      renderBoardPage('?tab=tags');
      await screen.findByText('Needs attention today');

      fireEvent.click(screen.getAllByTestId('custom-menu-icon-Actions')[0]);
      fireEvent.click(await screen.findByText('Remove from board'));
      const confirmation = setYesNoDialog.mock.lastCall![0];
      expect(confirmation.yesButtonLabel).toBe('Remove');
      act(() => confirmation.onYes());

      await waitFor(() => expect(deleteBoardTag).toHaveBeenCalledWith(boardId, urgentTag.tag_id));
    });
  });
});
