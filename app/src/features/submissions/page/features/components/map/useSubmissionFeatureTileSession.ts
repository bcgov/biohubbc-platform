import { CreateTileExtentSession, useTileExtentSession } from 'components/map/useTileExtentSession';
import { UseTileSessionResult } from 'components/map/useTileSession';
import { useApi } from 'hooks/useApi';
import { ITileExtentSession } from 'interfaces/useMartinApi.interface';
import { useCallback } from 'react';

/**
 * Owns the tile session for one submission feature's map.
 *
 * A thin binding of {@link useTileExtentSession} to the feature tile endpoint: the session is re-created whenever the
 * feature changes, refreshed before its token expires, and recovered from a rejected tile request within a bounded
 * budget. See the generic hook for the full behaviour.
 *
 * @param {number} submissionId
 * @param {number} submissionFeatureId
 * @return {UseTileSessionResult<ITileExtentSession>}
 */
export const useSubmissionFeatureTileSession = (
  submissionId: number,
  submissionFeatureId: number
): UseTileSessionResult<ITileExtentSession> => {
  const api = useApi();

  const createSession = useCallback<CreateTileExtentSession>(
    (signal) => api.martin.createSubmissionFeatureTileSession(submissionId, submissionFeatureId, { signal }),
    [api, submissionId, submissionFeatureId]
  );

  return useTileExtentSession(`${submissionId}:${submissionFeatureId}`, createSession);
};
