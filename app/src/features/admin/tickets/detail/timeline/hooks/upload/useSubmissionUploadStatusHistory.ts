import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useIsMounted from 'hooks/useIsMounted';
import {
  ISubmissionUploadProcessingStatusHistoryItem,
  TicketSubmissionUploadResponse
} from 'interfaces/useTicketsApi.interface';
import { useCallback, useRef, useState } from 'react';

export type SubmissionUploadStatusHistoryState =
  | { status: 'loading' }
  | { status: 'loaded'; history: ISubmissionUploadProcessingStatusHistoryItem[] }
  | { status: 'error'; message: string };

/**
 * Processing status history for the uploads on a ticket timeline, fetched on demand and cached by
 * submission upload id for as long as the owning component stays mounted.
 *
 * A successful response is reused by later requests for the same upload; a failed request is
 * retried the next time the upload's history is requested.
 *
 * @returns The cached history state per upload and the loader that populates it.
 */
export const useSubmissionUploadStatusHistory = () => {
  const api = useApi();
  const isMounted = useIsMounted();
  const statusHistoryRef = useRef<Record<string, SubmissionUploadStatusHistoryState>>({});
  const [statusHistoryByUploadId, setStatusHistoryByUploadId] = useState<
    Record<string, SubmissionUploadStatusHistoryState>
  >({});

  const setStatusHistory = useCallback((submissionUploadId: string, state: SubmissionUploadStatusHistoryState) => {
    statusHistoryRef.current = { ...statusHistoryRef.current, [submissionUploadId]: state };
    setStatusHistoryByUploadId(statusHistoryRef.current);
  }, []);

  /**
   * Fetch the processing status history for an upload unless it is already loaded or loading.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload whose history is requested.
   * @returns {Promise<void>} Resolves once the cached state reflects the outcome.
   */
  const loadStatusHistory = useCallback(
    async (upload: TicketSubmissionUploadResponse): Promise<void> => {
      const current = statusHistoryRef.current[upload.submission_upload_id];

      if (current?.status === 'loading' || current?.status === 'loaded') {
        return;
      }

      setStatusHistory(upload.submission_upload_id, { status: 'loading' });

      try {
        const history = await api.tickets.getSubmissionUploadProcessingStatusHistory(
          upload.submission_uuid,
          upload.submission_upload_id
        );

        if (!isMounted()) {
          return;
        }

        setStatusHistory(upload.submission_upload_id, { status: 'loaded', history });
      } catch (error) {
        if (!isMounted()) {
          return;
        }

        setStatusHistory(upload.submission_upload_id, { status: 'error', message: (error as APIError).message });
      }
    },
    [api, isMounted, setStatusHistory]
  );

  return { statusHistoryByUploadId, loadStatusHistory };
};
