import Box from '@mui/material/Box';
import { PropsWithChildren } from 'react';

export interface IMapFrameProps {
  /** Test selector for the frame. */
  testId: string;
  /** Fixed height, for a map embedded as one section of a page. */
  height?: number;
  /** Minimum height, for a map that grows to fill a flex panel; the frame then also stretches to the panel's width. */
  minHeight?: number;
}

/**
 * Fixed frame every state of a map renders inside.
 *
 * A map is swapped for a loading, empty or error state and back again; an unsized child would then take the size of
 * whatever is showing, and the surrounding page would jump. One frame with one footprint keeps the layout still while
 * only its content changes. The size is the frame's, never its content's: either a fixed `height` or a flex-filling
 * `minHeight`.
 *
 * @param {PropsWithChildren<IMapFrameProps>} props - Frame content, sizing and test selector.
 * @returns {JSX.Element} A consistently sized frame for a map or one of its states.
 */
export const MapFrame = (props: PropsWithChildren<IMapFrameProps>) => {
  const { testId, height, minHeight, children } = props;

  const sizing = height !== undefined ? { height } : { flex: '1 1 auto', width: '100%', minHeight };

  return (
    <Box data-testid={testId} sx={{ position: 'relative', display: 'flex', ...sizing }}>
      {children}
    </Box>
  );
};
