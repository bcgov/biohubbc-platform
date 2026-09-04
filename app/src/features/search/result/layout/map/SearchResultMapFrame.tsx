import Box from '@mui/material/Box';
import { MAP_VIEW_MIN_HEIGHT } from 'constants/spatial';
import { PropsWithChildren } from 'react';

/**
 * Fixed frame every state of the map view renders inside.
 *
 * The panel slot this view fills is a row flex container, so an unsized child collapses to its content — swapping the
 * map for a loading or error state would then change the panel's height and make the surrounding search UI jump. One
 * shared frame keeps the footprint identical across states; only the content inside it swaps.
 *
 * @param {PropsWithChildren<{ testId: string }>} props - Frame content and test selector.
 * @returns {JSX.Element} A consistently sized frame for a map, loading state, or error state.
 */
export const SearchResultMapFrame = (props: PropsWithChildren<{ testId: string }>) => (
  <Box
    data-testid={props.testId}
    sx={{ position: 'relative', display: 'flex', flex: '1 1 auto', width: '100%', minHeight: MAP_VIEW_MIN_HEIGHT }}>
    {props.children}
  </Box>
);
