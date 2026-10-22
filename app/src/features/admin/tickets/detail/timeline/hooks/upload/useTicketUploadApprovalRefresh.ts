import { useQueryClient } from '@tanstack/react-query';
import { useTicketContext } from 'hooks/useContext';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { useEffect, useRef } from 'react';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

/** How often the ticket is reloaded while an upload's approval is still being applied. */
export const TICKET_UPLOAD_APPROVAL_REFRESH_MS = 5000;

/**
 * Keeps the ticket current while any of its uploads is `approving`.
 *
 * Approval is applied by a background job after the request returns, so nothing else tells the ticket when an upload
 * moves on to `approved`. While any upload is approving, the ticket is reloaded on an interval; once none is, the
 * queries a decision changes are refreshed, because the upload's features were only published when the job finished.
 *
 * @param {ITicketExtended} ticket Ticket shown on the timeline.
 * @returns {void}
 */
export const useTicketUploadApprovalRefresh = (ticket: ITicketExtended): void => {
  const queryClient = useQueryClient();
  const { ticketId, ticketQueryKey } = useTicketContext();
  const isApproving = ticket.submission_uploads.some((upload) => upload.decision === 'approving');
  const wasApproving = useRef(isApproving);

  useEffect(() => {
    if (!isApproving) {
      return;
    }

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ticketQueryKey, exact: true });
    }, TICKET_UPLOAD_APPROVAL_REFRESH_MS);

    return () => clearInterval(interval);
  }, [isApproving, queryClient, ticketQueryKey]);

  useEffect(() => {
    if (wasApproving.current && !isApproving) {
      refreshChangedQueries(queryClient, changedQueryKeys.uploadDecision(ticketId), ticketQueryKey);
    }

    wasApproving.current = isApproving;
  }, [isApproving, queryClient, ticketId, ticketQueryKey]);
};
