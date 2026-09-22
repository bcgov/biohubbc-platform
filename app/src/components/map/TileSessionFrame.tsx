import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SkeletonMap } from 'components/loading/SkeletonLoaders';
import { MapFrame } from 'components/map/MapFrame';
import type { TileSessionCredentials, TileSessionStatus } from 'components/map/useTileSession';
import { ReactNode } from 'react';

export interface ITileSessionFrameProps<TSession extends TileSessionCredentials> {
  /**
   * Test selector of the ready frame. The other states derive theirs from it: `${testId}-loading`, `${testId}-empty`
   * and `${testId}-error`.
   */
  testId: string;
  /** Fixed height of the frame; see {@link MapFrame}. */
  height?: number;
  /** Minimum height of a flex-filling frame; see {@link MapFrame}. */
  minHeight?: number;
  /** Current status of the tile session. */
  status: TileSessionStatus;
  /** The tile session in hand, if any. */
  session: TSession | null;
  /** Re-request the session; wired to the error state's "Try again". */
  onRetry: () => void;
  /**
   * Message for the `empty` status. A session that can never be empty (a search) leaves it out, in which case the
   * status is treated as an error.
   */
  emptyMessage?: string;
  /** Render the map for a session in hand. */
  children: (session: TSession) => ReactNode;
}

/**
 * Renders a tile session's loading, empty and error states, and hands a session in hand to the map.
 *
 * Every state renders inside the same {@link MapFrame}, so the section keeps one footprint whichever is showing. The
 * skeleton shows only while there is no session at all: a re-mint with a session in hand (a token refresh, a
 * recovery) leaves the rendered map on screen rather than blanking it. Failures stay inside the frame; the page's
 * other sections do not depend on the map and must keep working.
 *
 * @template TSession
 * @param {ITileSessionFrameProps<TSession>} props - Session state, frame options and the map to render when ready.
 * @returns {JSX.Element} The frame with whichever state applies.
 */
export const TileSessionFrame = <TSession extends TileSessionCredentials>(props: ITileSessionFrameProps<TSession>) => {
  const { testId, height, minHeight, status, session, onRetry, emptyMessage, children } = props;

  if (status === 'loading' && !session) {
    return (
      <MapFrame testId={`${testId}-loading`} height={height} minHeight={minHeight}>
        <SkeletonMap />
      </MapFrame>
    );
  }

  if (status === 'empty' && emptyMessage) {
    return (
      <MapFrame testId={`${testId}-empty`} height={height} minHeight={minHeight}>
        <Box sx={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        </Box>
      </MapFrame>
    );
  }

  if (status === 'error' || !session) {
    return (
      <MapFrame testId={`${testId}-error`} height={height} minHeight={minHeight}>
        <Box
          sx={{
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            p: 4
          }}>
          <Typography variant="body2" color="text.secondary">
            The map could not be loaded.
          </Typography>
          <Button onClick={onRetry}>Try again</Button>
        </Box>
      </MapFrame>
    );
  }

  return (
    <MapFrame testId={testId} height={height} minHeight={minHeight}>
      {children(session)}
    </MapFrame>
  );
};
