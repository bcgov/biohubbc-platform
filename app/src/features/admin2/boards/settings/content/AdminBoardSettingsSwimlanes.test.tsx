import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IBoardDetail, IBoardSwimlane, IBoardTag } from 'interfaces/useBoardsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { Mock } from 'vitest';
import { AdminBoardSettingsSwimlanes } from './AdminBoardSettingsSwimlanes';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: vi.fn() }));

const boardId = '11111111-1111-4111-8111-111111111111';
const urgent: IBoardTag = { board_tag_id: 'board-tag-1', tag_id: 'tag-1', name: 'Urgent', color: '#D8292F' };
const review: IBoardTag = { board_tag_id: 'board-tag-2', tag_id: 'tag-2', name: 'Review', color: '#1A5A96' };

/**
 * Builds a swimlane of the test board.
 *
 * @param {string} id The swimlane id.
 * @param {string} name The swimlane name.
 * @param {number} sortOrder The swimlane position.
 * @returns {IBoardSwimlane} The swimlane.
 */
const makeSwimlane = (id: string, name: string, sortOrder: number): IBoardSwimlane => ({
  board_swimlane_id: id,
  board_id: boardId,
  name,
  description: null,
  color: null,
  sort_order: sortOrder,
  is_visible: true,
  tags: [urgent]
});

const blocked = makeSwimlane('lane-1', 'Blocked', 0);
const inReview = makeSwimlane('lane-2', 'In review', 1);
const board: IBoardDetail = {
  board_id: boardId,
  name: 'Triage',
  description: null,
  color: '#1A5A96',
  create_date: '2026-10-01T00:00:00.000Z',
  tags: [urgent, review],
  swimlanes: [blocked, inReview]
};

describe('AdminBoardSettingsSwimlanes', () => {
  const updateBoardSwimlaneOrder = vi.fn();
  const updateBoardSwimlane = vi.fn();
  const setSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useApi as Mock).mockReturnValue({ boards: { updateBoardSwimlaneOrder, updateBoardSwimlane }, tags: {} });
    (useDialogContext as Mock).mockReturnValue({ setSnackbar, setYesNoDialog: vi.fn() });
  });

  /**
   * Renders the swimlanes of the cached board, re-rendering whenever the cache changes, as the settings page does.
   *
   * @returns The query client holding the board.
   */
  const renderSwimlanes = () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(boardQueryKeys.detail(boardId), board);
    const view = render(<AdminBoardSettingsSwimlanes board={board} />, { queryClient });
    queryClient.getQueryCache().subscribe(() => {
      const cached = queryClient.getQueryData<IBoardDetail>(boardQueryKeys.detail(boardId));
      if (cached) {
        view.rerender(<AdminBoardSettingsSwimlanes board={cached} />);
      }
    });
    return queryClient;
  };

  it('moves a lane by sending the full new order, showing it before the save completes', async () => {
    let finishSave!: (response: { swimlanes: IBoardSwimlane[] }) => void;
    updateBoardSwimlaneOrder.mockReturnValue(new Promise((resolve) => (finishSave = resolve)));
    const queryClient = renderSwimlanes();

    expect(screen.getByRole('button', { name: 'move Blocked up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'move In review down' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'move Blocked down' }));

    await waitFor(() =>
      expect(updateBoardSwimlaneOrder).toHaveBeenCalledWith(boardId, { swimlaneIds: ['lane-2', 'lane-1'] })
    );
    const rows = screen.getAllByTestId(/^swimlane-row-/).map((row) => row.getAttribute('data-testid'));
    expect(rows).toEqual(['swimlane-row-lane-2', 'swimlane-row-lane-1']);

    await act(async () => finishSave({ swimlanes: [inReview, blocked] }));
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
  });

  it('restores the previous order and reports the error when the move fails', async () => {
    updateBoardSwimlaneOrder.mockRejectedValue(new Error('Order rejected'));
    const queryClient = renderSwimlanes();

    fireEvent.click(screen.getByRole('button', { name: 'move In review up' }));

    await waitFor(() => expect(setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Order rejected' }));
    expect(queryClient.getQueryData<IBoardDetail>(boardQueryKeys.detail(boardId))?.swimlanes).toEqual([
      blocked,
      inReview
    ]);
  });

  it('hides a lane by saving the lane with its tags and the new visibility', async () => {
    updateBoardSwimlane.mockResolvedValue({ ...blocked, is_visible: false });
    renderSwimlanes();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Blocked visible' }));

    await waitFor(() =>
      expect(updateBoardSwimlane).toHaveBeenCalledWith(boardId, 'lane-1', {
        name: 'Blocked',
        description: null,
        color: null,
        isVisible: false,
        boardTagIds: ['board-tag-1']
      })
    );
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Blocked visible' })).not.toBeChecked());
  });

  it("offers only the board's tags for a lane and saves the picked ones by board tag id", async () => {
    updateBoardSwimlane.mockResolvedValue({ ...blocked, tags: [urgent, review] });
    renderSwimlanes();

    fireEvent.click(screen.getAllByTitle('Swimlane actions')[0]);
    fireEvent.click(await screen.findByText('Edit swimlane'));
    fireEvent.mouseDown(within(await screen.findByTestId('swimlane-tags')).getByRole('combobox'));

    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Urgent', 'Review']);
    fireEvent.click(options[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateBoardSwimlane).toHaveBeenCalledWith(boardId, 'lane-1', {
        name: 'Blocked',
        description: null,
        color: null,
        isVisible: true,
        boardTagIds: ['board-tag-1', 'board-tag-2']
      })
    );
  });
});
