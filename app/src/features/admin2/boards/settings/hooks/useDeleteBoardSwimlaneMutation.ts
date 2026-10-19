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

/**
 * Deletes a board swimlane, removing it from the board's cached detail once deleted, and reports the result.
 *
 * Shares the detail's key with the other swimlane changes: the lane is removed from the cache only when no other
 * change overlaps it; otherwise the detail reloads once the last settles. The board list and the board's tickets
 * refresh after each delete.
 *
 * @param {string} boardId The board the swimlane belongs to.
 * @returns The mutation; call `mutate` with the swimlane to delete.
 */
export const useDeleteBoardSwimlaneMutation = (boardId: string) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const boardQueryKey = boardQueryKeys.detail(boardId);

  return useCoordinatedMutation<void, Error, IBoardSwimlane>({
    mutationKey: boardQueryKey,
    mutationFn: (swimlane) => api.boards.deleteBoardSwimlane(boardId, swimlane.board_swimlane_id),
    onSuccess: async (_data, swimlane) => {
      await cancelQueryForOptimisticUpdate(queryClient, boardQueryKey, boardQueryKey);
      if (!holdReloadIfConcurrent(queryClient, boardQueryKey, boardQueryKey)) {
        queryClient.setQueryData<IBoardDetail>(
          boardQueryKey,
          (current) =>
            current && {
              ...current,
              swimlanes: current.swimlanes.filter((row) => row.board_swimlane_id !== swimlane.board_swimlane_id)
            }
        );
      }
      void refreshChangedQueries(queryClient, changedQueryKeys.board(), boardQueryKey);
      setSnackbar({ open: true, snackbarMessage: `Deleted swimlane ${swimlane.name}` });
    },
    onError: (error) => setSnackbar({ open: true, snackbarMessage: error.message })
  });
};
