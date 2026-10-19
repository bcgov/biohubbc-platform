import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Loading placeholder matching the board settings: the board section, then the swimlanes section with lane rows.
 *
 * @returns {JSX.Element} The board settings skeleton.
 */
export const AdminBoardSettingsSkeleton = () => {
  return (
    <Stack gap={3} data-testid="board-settings-skeleton">
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="text" width={160} height={40} />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="text" width={160} height={40} />
        <Stack gap={1}>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} variant="rounded" height={72} />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
};
