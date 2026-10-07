import { reconcileAfterMutations } from 'hooks/useCoordinatedMutation';
import { useQueryClient } from '@tanstack/react-query';
import { useTicketContext } from 'hooks/useContext';
import { ITicketCommentLog, ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

/**
 * Writes to the cached ticket's comments, shared by ticket comment flows.
 *
 * Each write applies to the ticket as cached when it runs, and leaves the cache unchanged while the ticket
 * has not loaded. A load of the ticket that was already in flight is repeated, since it predates the saved comment, and
 * the ticket's other cached details are refreshed.
 *
 * @returns Comment cache mutation helpers.
 */
export const useTicketCommentCache = () => {
  const queryClient = useQueryClient();
  const { ticketId, ticketQueryKey } = useTicketContext();

  /**
   * Writes a saved comment change into the cached ticket and refreshes the ticket's other copies.
   *
   * @param {(ticket: ITicketExtended) => ITicketExtended} update Builds the ticket with the change.
   * @returns {Promise<void>} Resolves after the cache write and any immediate refresh.
   */
  const writeSavedComment = async (update: (ticket: ITicketExtended) => ITicketExtended) => {
    const hadPendingRead = queryClient.isFetching({ queryKey: ticketQueryKey, exact: true }) > 0;
    await queryClient.cancelQueries({ queryKey: ticketQueryKey, exact: true });
    queryClient.setQueryData<ITicketExtended>(ticketQueryKey, (ticket) => ticket && update(ticket));
    if (hadPendingRead) {
      await reconcileAfterMutations(queryClient, ticketQueryKey, ticketQueryKey);
    }
    await refreshChangedQueries(queryClient, changedQueryKeys.ticketDetail(ticketId), ticketQueryKey);
  };

  /**
   * Append a comment to the cached ticket details.
   *
   * Used after the API returns a created comment. If ticket details are not loaded, the cache is left unchanged.
   *
   * @param {ITicketCommentLog} newComment Comment to append.
   * @returns {Promise<void>} Resolves after the cache write and any immediate refresh.
   */
  const appendCachedComment = (newComment: ITicketCommentLog) => {
    return writeSavedComment((ticket) => ({
      ...ticket,
      comments: [
        ...ticket.comments.filter((comment) => comment.ticket_comment_id !== newComment.ticket_comment_id),
        newComment
      ]
    }));
  };

  /**
   * Remove a comment from the cached ticket details.
   *
   * Used by persisted deletes. If ticket details are not loaded, the cache is left unchanged.
   *
   * @param {string} ticketCommentId Comment identifier to remove.
   * @returns {Promise<void>} Resolves after the cache write and any immediate refresh.
   */
  const removeCachedComment = (ticketCommentId: string) => {
    return writeSavedComment((ticket) => ({
      ...ticket,
      comments: ticket.comments.filter((comment) => comment.ticket_comment_id !== ticketCommentId)
    }));
  };

  /**
   * Replace a comment in the cached ticket details.
   *
   * Used after successful create and edit calls. If the comment is no longer cached, the cache is left unchanged.
   *
   * @param {string} ticketCommentId Comment identifier to replace.
   * @param {ITicketCommentLog} replacementComment Comment to write into the cache.
   * @returns {Promise<void>} Resolves after the cache write and any immediate refresh.
   */
  const replaceCachedComment = (ticketCommentId: string, replacementComment: ITicketCommentLog) => {
    return writeSavedComment((ticket) => {
      if (!ticket.comments.some((comment) => comment.ticket_comment_id === ticketCommentId)) {
        return ticket;
      }

      return {
        ...ticket,
        comments: ticket.comments.map((comment) =>
          comment.ticket_comment_id === ticketCommentId ? replacementComment : comment
        )
      };
    });
  };

  return {
    appendCachedComment,
    removeCachedComment,
    replaceCachedComment
  };
};
