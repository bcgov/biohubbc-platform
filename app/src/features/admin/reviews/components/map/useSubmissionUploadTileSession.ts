import { CreateTileExtentSession, useTileExtentSession } from 'components/map/useTileExtentSession';
import { UseTileSessionResult } from 'components/map/useTileSession';
import { useApi } from 'hooks/useApi';
import { ReconciliationType } from 'interfaces/useAdminApi.interface';
import { ITileExtentSession } from 'interfaces/useMartinApi.interface';
import { useCallback } from 'react';

/**
 * Identity of what an upload map draws: the upload, and the reconciliation outcome when the map is limited to one.
 *
 * @param {number} submissionId
 * @param {string} submissionUploadId
 * @param {ReconciliationType} [reconciliation]
 * @return {string}
 */
export const getSubmissionUploadMapKey = (
  submissionId: number,
  submissionUploadId: string,
  reconciliation?: ReconciliationType
): string => [submissionId, submissionUploadId, reconciliation].filter(Boolean).join(':');

/**
 * Owns the tile session for the map of one submission upload's active features, optionally limited to one
 * reconciliation outcome.
 *
 * A thin binding of {@link useTileExtentSession} to the administrative upload tile endpoint: the session is re-created
 * whenever the upload or the outcome changes, refreshed before its token expires, and recovered from a rejected tile
 * request within a bounded budget. See the generic hook for the full behaviour.
 *
 * @param {number} submissionId
 * @param {string} submissionUploadId
 * @param {ReconciliationType} [reconciliation] Outcome whose features are mapped; every outcome when omitted.
 * @return {UseTileSessionResult<ITileExtentSession>}
 */
export const useSubmissionUploadTileSession = (
  submissionId: number,
  submissionUploadId: string,
  reconciliation?: ReconciliationType
): UseTileSessionResult<ITileExtentSession> => {
  const api = useApi();

  const createSession = useCallback<CreateTileExtentSession>(
    (signal) =>
      api.martin.createSubmissionUploadTileSession(submissionId, submissionUploadId, { signal, reconciliation }),
    [api, submissionId, submissionUploadId, reconciliation]
  );

  return useTileExtentSession(
    getSubmissionUploadMapKey(submissionId, submissionUploadId, reconciliation),
    createSession
  );
};
