import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Loading placeholder matching the board's columns: three lanes, each with a header and ticket cards.
 *
 * @returns {JSX.Element} The board skeleton.
 */
export const AdminBoardLanesSkeleton = () => {
  return (
    <Stack direction="row" gap={2} sx={{ overflowX: 'hidden' }} data-testid="board-lanes-skeleton">
      {[0, 1, 2].map((lane) => (
        <Paper key={lane} variant="outlined" sx={{ flex: '0 0 300px', width: 300, p: 1 }}>
          <Skeleton variant="text" width="50%" sx={{ mx: 1, my: 1 }} />
          <Stack gap={1}>
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} variant="rounded" height={88} />
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};
