import { useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import {
  cancelQueryForOptimisticUpdate,
  holdReloadIfConcurrent,
  useCoordinatedMutation
} from 'hooks/useCoordinatedMutation';
import { IBoardDetail, IBoardSwimlane, IBoardSwimlanesResponse } from 'interfaces/useBoardsApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

interface UpdateBoardSwimlaneOrderContext {
  /** The board before the change. */
  previous: IBoardDetail | undefined;
}

/**
 * Saves the left-to-right order of a board's swimlanes, showing the new order in the board's cached detail before
 * the request completes. The order endpoint takes every lane of the board, so each change sends the full list.
 *
 * Shares the detail's key with the other swimlane changes: a response is written only when no other change overlaps
 * it, and a failure restores the previous order when no other change is running, and is reported.
 *
 * @param {string} boardId The board whose swimlanes are reordered.
 * @returns The mutation; call `mutate` with every swimlane of the board in its new order.
 */
export const useUpdateBoardSwimlaneOrderMutation = (boardId: string) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const boardQueryKey = boardQueryKeys.detail(boardId);

  return useCoordinatedMutation<IBoardSwimlanesResponse, Error, IBoardSwimlane[], UpdateBoardSwimlaneOrderContext>({
    mutationKey: boardQueryKey,
    mutationFn: (swimlanes) =>
      api.boards.updateBoardSwimlaneOrder(boardId, {
        swimlaneIds: swimlanes.map((swimlane) => swimlane.board_swimlane_id)
      }),
    onMutate: async (swimlanes) => {
      holdReloadIfConcurrent(queryClient, boardQueryKey, boardQueryKey);
      await cancelQueryForOptimisticUpdate(queryClient, boardQueryKey, boardQueryKey);
      const previous = queryClient.getQueryData<IBoardDetail>(boardQueryKey);
      queryClient.setQueryData<IBoardDetail>(boardQueryKey, (current) => current && { ...current, swimlanes });
      return { previous };
    },
    onSuccess: async (saved) => {
      await cancelQueryForOptimisticUpdate(queryClient, boardQueryKey, boardQueryKey);
      if (!holdReloadIfConcurrent(queryClient, boardQueryKey, boardQueryKey)) {
        queryClient.setQueryData<IBoardDetail>(
          boardQueryKey,
          (current) => current && { ...current, swimlanes: saved.swimlanes }
        );
      }
      void refreshChangedQueries(queryClient, changedQueryKeys.board(), boardQueryKey);
    },
    onError: (error, _swimlanes, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      if (holdReloadIfConcurrent(queryClient, boardQueryKey, boardQueryKey)) {
        return;
      }
      queryClient.setQueryData<IBoardDetail>(boardQueryKey, context?.previous);
    }
  });
};
