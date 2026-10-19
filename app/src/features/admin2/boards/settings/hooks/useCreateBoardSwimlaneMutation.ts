import { useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import {
  cancelQueryForOptimisticUpdate,
  holdReloadIfConcurrent,
  useCoordinatedMutation
} from 'hooks/useCoordinatedMutation';
import { IBoardDetail, IBoardSwimlane, IBoardSwimlaneRequest } from 'interfaces/useBoardsApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

/**
 * Adds a swimlane to the end of a board, appending the saved lane to the board's cached detail.
 *
 * Shares the detail's key with the other swimlane changes: the saved lane is appended only when no other change
 * overlaps it; otherwise the detail reloads once the last settles. Callers show `error` in their dialog. The board
 * list and the board's tickets refresh after each save.
 *
 * @param {string} boardId The board the swimlane is added to.
 * @returns The mutation; call `mutate` with the new swimlane's request body.
 */
export const useCreateBoardSwimlaneMutation = (boardId: string) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const boardQueryKey = boardQueryKeys.detail(boardId);

  return useCoordinatedMutation<IBoardSwimlane, Error, IBoardSwimlaneRequest>({
    mutationKey: boardQueryKey,
    mutationFn: (request) => api.boards.createBoardSwimlane(boardId, request),
    onSuccess: async (saved) => {
      await cancelQueryForOptimisticUpdate(queryClient, boardQueryKey, boardQueryKey);
      if (!holdReloadIfConcurrent(queryClient, boardQueryKey, boardQueryKey)) {
        // The server places a new lane last in the board's order.
        queryClient.setQueryData<IBoardDetail>(
          boardQueryKey,
          (current) => current && { ...current, swimlanes: [...current.swimlanes, saved] }
        );
      }
      void refreshChangedQueries(queryClient, changedQueryKeys.board(), boardQueryKey);
    }
  });
};
