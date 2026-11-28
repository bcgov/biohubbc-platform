import { useTileExtentSession } from 'components/map/useTileExtentSession';
import { UseTileSessionResult } from 'components/map/useTileSession';
import { CreateTileExtentSessionResponse, ITileExtentSession } from 'interfaces/useMartinApi.interface';
import { useCallback } from 'react';

/**
 * Requests a tile session for one submission feature from the endpoint that serves the page: the public feature
 * endpoint, or the submission's own feature endpoint on the Portal.
 */
export type CreateSubmissionFeatureTileSession = (
  submissionFeatureId: number,
  signal: AbortSignal
) => Promise<CreateTileExtentSessionResponse>;

/**
 * Owns the tile session for one submission feature's map.
 *
 * A thin binding of {@link useTileExtentSession} to a feature tile endpoint: the session is re-created whenever the
 * feature changes, refreshed before its token expires, and recovered from a rejected tile request within a bounded
 * budget. See the generic hook for the full behaviour.
 *
 * @param {number} submissionFeatureId
 * @param {CreateSubmissionFeatureTileSession} createTileSession Requests a session; keep its identity stable.
 * @return {UseTileSessionResult<ITileExtentSession>}
 */
export const useSubmissionFeatureTileSession = (
  submissionFeatureId: number,
  createTileSession: CreateSubmissionFeatureTileSession
): UseTileSessionResult<ITileExtentSession> => {
  const createSession = useCallback(
    (signal: AbortSignal) => createTileSession(submissionFeatureId, signal),
    [createTileSession, submissionFeatureId]
  );

  return useTileExtentSession(String(submissionFeatureId), createSession);
};
