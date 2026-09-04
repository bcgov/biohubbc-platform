import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useIsMounted from 'hooks/useIsMounted';
import {
  ISubmissionUploadProcessingStatusHistoryItem,
  SubmissionUploadJobStatus,
  TicketSubmissionUploadResponse
} from 'interfaces/useTicketsApi.interface';
import { useCallback, useRef, useState } from 'react';

export type SubmissionUploadStatusHistoryState =
  | { status: 'loading' }
  | {
      status: 'loaded';
      history: ISubmissionUploadProcessingStatusHistoryItem[];
      /** Upload status the history was loaded for; a later status means the history is stale. */
      uploadStatus: SubmissionUploadJobStatus;
    }
  | { status: 'error'; message: string };

/**
 * Processing status history for the uploads on a ticket timeline, fetched on demand and cached by
 * submission upload id for as long as the owning component stays mounted.
 *
 * A successful response is reused by later requests for the same upload until the upload's current
 * status changes, at which point the history is fetched again; a failed request is retried the next
 * time the upload's history is requested.
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

  /**
   * Store the history state for one upload in both the ref read by in-flight loads and the state
   * that drives rendering.
   *
   * @param {string} submissionUploadId Upload the state belongs to.
   * @param {SubmissionUploadStatusHistoryState} state New history state for the upload.
   * @returns {void}
   */
  const setStatusHistory = useCallback((submissionUploadId: string, state: SubmissionUploadStatusHistoryState) => {
    statusHistoryRef.current = { ...statusHistoryRef.current, [submissionUploadId]: state };
    setStatusHistoryByUploadId(statusHistoryRef.current);
  }, []);

  /**
   * Fetch the processing status history for an upload unless it is already loading or was loaded
   * for the status the upload currently holds.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload whose history is requested.
   * @returns {Promise<void>} Resolves once the cached state reflects the outcome.
   */
  const loadStatusHistory = useCallback(
    async (upload: TicketSubmissionUploadResponse): Promise<void> => {
      const current = statusHistoryRef.current[upload.submission_upload_id];

      if (current?.status === 'loading') {
        return;
      }

      if (current?.status === 'loaded' && current.uploadStatus === upload.upload_status) {
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

        setStatusHistory(upload.submission_upload_id, {
          status: 'loaded',
          history,
          uploadStatus: upload.upload_status
        });
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
