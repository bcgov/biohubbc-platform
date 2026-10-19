import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { IBoardDetail, IBoardRequest } from 'interfaces/useBoardsApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { IBoardFormValues } from '../form/BoardForm';

/** A board save: the board to update, or none to create one, and the dialog's values. */
export interface SaveBoardVariables {
  boardId: string | undefined;
  values: IBoardFormValues;
}

/**
 * Creates a board, or updates one replacing its tags, from the board dialog's values. The saved board is written to
 * its cached detail, and every other board query refreshes: the list shows the board's tags, and its tickets depend
 * on them.
 *
 * Callers close their dialog with `mutate`'s own `onSuccess` and show `error` in the dialog.
 *
 * @returns The mutation; call `mutate` with {@link SaveBoardVariables}.
 */
export const useSaveBoardMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<IBoardDetail, Error, SaveBoardVariables>({
    mutationFn: ({ boardId, values }) => {
      const payload: IBoardRequest = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        color: values.color,
        tagIds: values.tags.map((tag) => tag.tag_id)
      };

      if (boardId) {
        return api.boards.updateBoard(boardId, payload);
      }

      return api.boards.createBoard(payload);
    },
    onSuccess: (saved) => {
      const boardQueryKey = boardQueryKeys.detail(saved.board_id);
      queryClient.setQueryData<IBoardDetail>(boardQueryKey, saved);
      return refreshChangedQueries(queryClient, changedQueryKeys.board(), boardQueryKey);
    }
  });
};
