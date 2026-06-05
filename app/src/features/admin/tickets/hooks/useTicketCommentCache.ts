import { useTicketContext } from 'hooks/useContext';
import { ITicketCommentLog } from 'interfaces/useTicketsApi.interface';

/**
 * Cached ticket comment mutations shared by ticket comment flows.
 *
 * @returns Comment cache mutation helpers.
 */
export const useTicketCommentCache = () => {
  const { ticketDataLoader } = useTicketContext();

  /**
   * Append a comment to the cached ticket details.
   *
   * Used after the API returns a created comment. If ticket details are not loaded, the cache is left unchanged.
   *
   * @param {ITicketCommentLog} newComment Comment to append.
   * @returns {void}
   */
  const appendCachedComment = (newComment: ITicketCommentLog) => {
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      comments: [...latestTicket.comments, newComment]
    });
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
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      comments: latestTicket.comments.filter((comment) => comment.ticket_comment_id !== ticketCommentId)
    });
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
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    const hasCachedComment = latestTicket.comments.some((comment) => comment.ticket_comment_id === ticketCommentId);

    if (!hasCachedComment) {
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      comments: latestTicket.comments.map((comment) =>
        comment.ticket_comment_id === ticketCommentId ? replacementComment : comment
      )
    });
  };

  return {
    appendCachedComment,
    removeCachedComment,
    replaceCachedComment
  };
};
