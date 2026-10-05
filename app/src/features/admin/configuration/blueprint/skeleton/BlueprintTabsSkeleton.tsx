import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Match the blueprint navigation tabs while metadata loads.
 *
 * @param props Number of tabs in the selected blueprint view.
 * @returns Tab placeholders with matching spacing and widths.
 */
export const BlueprintTabsSkeleton = ({ tabCount }: { tabCount: number }) => (
  <Stack direction="row" sx={{ height: 48 }}>
    {Array.from({ length: tabCount }, (_, index) => (
      <Stack key={index} justifyContent="center" sx={{ px: 2, minWidth: 90 }}>
        <Skeleton width={index === 0 && tabCount === 2 ? 100 : 80} />
      </Stack>
    ))}
  </Stack>
);
