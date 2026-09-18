import { TileSessionStatus, UseTileSessionResult, useTileSession } from 'components/map/useTileSession';
import { CreateTileExtentSessionResponse, ITileExtentSession } from 'interfaces/useMartinApi.interface';
import { useCallback } from 'react';

export type TileExtentSessionStatus = TileSessionStatus;

/**
 * Mint a tile session for the mapped subject. Receives an abort signal that fires when the request is superseded.
 */
export type CreateTileExtentSession = (signal: AbortSignal) => Promise<CreateTileExtentSessionResponse>;

export type UseTileExtentSessionResult = UseTileSessionResult<ITileExtentSession>;

/**
 * Owns the tile session for a map of one subject with a fixed extent (a submission feature, a submission upload).
 *
 * A binding of {@link useTileSession} to the extent session shape: a response without spatial properties carries no
 * token and becomes the `empty` status. The session is re-created whenever `sessionKey` changes, refreshed before its
 * token expires, and recovered from a rejected tile request within a bounded budget; see the generic hook for the full
 * behaviour. A failure is reported through `status` alone, never a snackbar: the map is one section of a page whose
 * other sections stay usable.
 *
 * @param {string} sessionKey - Identity of the mapped subject. Changing it drops the session and mints a new one.
 * @param {CreateTileExtentSession} createSession - Mints a session for the subject.
 * @return {UseTileExtentSessionResult}
 */
export const useTileExtentSession = (
  sessionKey: string,
  createSession: CreateTileExtentSession
): UseTileExtentSessionResult => {
  const mint = useCallback(
    async (signal: AbortSignal): Promise<ITileExtentSession | null> => {
      const response = await createSession(signal);

      return response.has_spatial_properties ? response : null;
    },
    [createSession]
  );

  return useTileSession<ITileExtentSession>({ sessionKey, mint });
};
