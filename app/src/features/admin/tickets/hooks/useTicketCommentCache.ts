import { useQueryClient } from '@tanstack/react-query';
import { useTicketContext } from 'hooks/useContext';
import { ITicketCommentLog, ITicketExtended } from 'interfaces/useTicketsApi.interface';

/**
 * Writes to the cached ticket's comments, shared by ticket comment flows.
 *
 * Each write applies to the ticket as cached when it runs, and leaves the cache unchanged while the ticket
 * has not loaded.
 *
 * @returns Comment cache mutation helpers.
 */
export const useTicketCommentCache = () => {
  const queryClient = useQueryClient();
  const { ticketQueryKey } = useTicketContext();

  /**
   * Append a comment to the cached ticket details.
   *
   * Used after the API returns a created comment. If ticket details are not loaded, the cache is left unchanged.
   *
   * @param {ITicketCommentLog} newComment Comment to append.
   * @returns {void}
   */
  const appendCachedComment = (newComment: ITicketCommentLog) => {
    queryClient.setQueryData<ITicketExtended>(
      ticketQueryKey,
      (ticket) => ticket && { ...ticket, comments: [...ticket.comments, newComment] }
    );
  };

  /**
   * Remove a comment from the cached ticket details.
   *
   * Used by persisted deletes. If ticket details are not loaded, the cache is left unchanged.
   *
   * @param {string} ticketCommentId Comment identifier to remove.
   * @returns {void}
   */
  const removeCachedComment = (ticketCommentId: string) => {
    queryClient.setQueryData<ITicketExtended>(
      ticketQueryKey,
      (ticket) =>
        ticket && {
          ...ticket,
          comments: ticket.comments.filter((comment) => comment.ticket_comment_id !== ticketCommentId)
        }
    );
  };

  /**
   * Replace a comment in the cached ticket details.
   *
   * Used after successful create and edit calls. If the comment is no longer cached, the cache is left unchanged.
   *
   * @param {string} ticketCommentId Comment identifier to replace.
   * @param {ITicketCommentLog} replacementComment Comment to write into the cache.
   * @returns {void}
   */
  const replaceCachedComment = (ticketCommentId: string, replacementComment: ITicketCommentLog) => {
    queryClient.setQueryData<ITicketExtended>(ticketQueryKey, (ticket) => {
      if (!ticket?.comments.some((comment) => comment.ticket_comment_id === ticketCommentId)) {
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
