import { useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import {
  cancelQueryForOptimisticUpdate,
  holdReloadIfConcurrent,
  useCoordinatedMutation
} from 'hooks/useCoordinatedMutation';
import { IBoardDetail, IBoardSwimlane } from 'interfaces/useBoardsApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

interface UpdateBoardSwimlaneContext {
  /** The board before the change. */
  previous: IBoardDetail | undefined;
}

/**
 * Saves a board swimlane's name, description, color, visibility and tags, showing the change in the board's cached
 * detail before the request completes.
 *
 * Every swimlane change on the board shares the detail's key, so a response is written only when no other change
 * overlaps it; otherwise the detail reloads once the last settles. A failure restores the previous board when no
 * other change is running, and reports the error. The board list and the board's tickets refresh after each save.
 *
 * @param {string} boardId The board the swimlane belongs to.
 * @returns The mutation; call `mutate` with the swimlane as it should be saved.
 */
export const useUpdateBoardSwimlaneMutation = (boardId: string) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const boardQueryKey = boardQueryKeys.detail(boardId);

  /**
   * Builds a cache updater that puts a swimlane in place of the board's lane with the same id.
   *
   * @param {IBoardSwimlane} swimlane The swimlane to put in place.
   * @returns The board detail updater.
   */
  const replaceSwimlane = (swimlane: IBoardSwimlane) => (current: IBoardDetail | undefined) =>
    current && {
      ...current,
      swimlanes: current.swimlanes.map((row) => (row.board_swimlane_id === swimlane.board_swimlane_id ? swimlane : row))
    };

  return useCoordinatedMutation<IBoardSwimlane, Error, IBoardSwimlane, UpdateBoardSwimlaneContext>({
    mutationKey: boardQueryKey,
    mutationFn: (swimlane) =>
      api.boards.updateBoardSwimlane(boardId, swimlane.board_swimlane_id, {
        name: swimlane.name,
        description: swimlane.description,
        color: swimlane.color,
        isVisible: swimlane.is_visible,
        boardTagIds: swimlane.tags.map((tag) => tag.board_tag_id)
      }),
    onMutate: async (swimlane) => {
      holdReloadIfConcurrent(queryClient, boardQueryKey, boardQueryKey);
      await cancelQueryForOptimisticUpdate(queryClient, boardQueryKey, boardQueryKey);
      const previous = queryClient.getQueryData<IBoardDetail>(boardQueryKey);
      queryClient.setQueryData<IBoardDetail>(boardQueryKey, replaceSwimlane(swimlane));
      return { previous };
    },
    onSuccess: async (saved) => {
      await cancelQueryForOptimisticUpdate(queryClient, boardQueryKey, boardQueryKey);
      if (!holdReloadIfConcurrent(queryClient, boardQueryKey, boardQueryKey)) {
        queryClient.setQueryData<IBoardDetail>(boardQueryKey, replaceSwimlane(saved));
      }
      void refreshChangedQueries(queryClient, changedQueryKeys.board(), boardQueryKey);
    },
    onError: (error, _swimlane, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      if (holdReloadIfConcurrent(queryClient, boardQueryKey, boardQueryKey)) {
        return;
      }
      queryClient.setQueryData<IBoardDetail>(boardQueryKey, context?.previous);
    }
  });
};
