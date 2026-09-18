import {
  CreateTileExtentSession,
  UseTileExtentSessionResult,
  useTileExtentSession
} from 'components/map/useTileExtentSession';
import { useApi } from 'hooks/useApi';
import { useCallback } from 'react';

/**
 * Owns the tile session for the map of one submission upload's active features.
 *
 * A thin binding of {@link useTileExtentSession} to the administrative upload tile endpoint: the session is re-created
 * whenever the upload changes, refreshed before its token expires, and recovered from a rejected tile request within a
 * bounded budget. See the generic hook for the full behaviour.
 *
 * @param {number} submissionId
 * @param {string} submissionUploadId
 * @return {UseTileExtentSessionResult}
 */
export const useSubmissionUploadTileSession = (
  submissionId: number,
  submissionUploadId: string
): UseTileExtentSessionResult => {
  const api = useApi();

  const createSession = useCallback<CreateTileExtentSession>(
    (signal) => api.martin.createSubmissionUploadTileSession(submissionId, submissionUploadId, { signal }),
    [api, submissionId, submissionUploadId]
  );

  return useTileExtentSession(`${submissionId}:${submissionUploadId}`, createSession);
};
