import { useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import {
  cancelQueryForOptimisticUpdate,
  holdReloadIfConcurrent,
  useCoordinatedMutation
} from 'hooks/useCoordinatedMutation';
import { ITagSummary, ITicketTagsResponse } from 'interfaces/useTagsApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';

interface UpdateTicketTagsContext {
  /** The ticket's tags and history before the change. */
  previous: ITicketTagsResponse | undefined;
}

/**
 * Replaces the route ticket's tags, showing the new set before the request completes.
 *
 * Each change sends the complete set, so the saved response, which also carries the new tag history, replaces the
 * cache unless other changes overlap; overlapping changes reload the tags once the last settles. A failure restores
 * the previous tags when no other change is running, and reports the error.
 *
 * @returns The mutation; call `mutate` with the complete set of tags.
 */
export const useUpdateTicketTagsMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId } = useTicketContext();
  const tagsQueryKey = ticketQueryKeys.tags(ticketId);

  return useCoordinatedMutation<ITicketTagsResponse, Error, ITagSummary[], UpdateTicketTagsContext>({
    mutationKey: tagsQueryKey,
    mutationFn: (tags) => api.tags.updateTicketTags(ticketId, { tagIds: tags.map((tag) => tag.tag_id) }),
    onMutate: async (tags) => {
      holdReloadIfConcurrent(queryClient, tagsQueryKey, tagsQueryKey);
      await cancelQueryForOptimisticUpdate(queryClient, tagsQueryKey, tagsQueryKey);
      const previous = queryClient.getQueryData<ITicketTagsResponse>(tagsQueryKey);
      queryClient.setQueryData<ITicketTagsResponse>(tagsQueryKey, (current) => current && { ...current, tags });
      return { previous };
    },
    onSuccess: async (saved) => {
      await cancelQueryForOptimisticUpdate(queryClient, tagsQueryKey, tagsQueryKey);
      if (!holdReloadIfConcurrent(queryClient, tagsQueryKey, tagsQueryKey)) {
        queryClient.setQueryData<ITicketTagsResponse>(tagsQueryKey, saved);
      }
      void refreshChangedQueries(queryClient, changedQueryKeys.ticketTags());
    },
    onError: (error, _tags, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      if (holdReloadIfConcurrent(queryClient, tagsQueryKey, tagsQueryKey)) {
        return;
      }
      queryClient.setQueryData<ITicketTagsResponse>(tagsQueryKey, context?.previous);
    }
  });
};
