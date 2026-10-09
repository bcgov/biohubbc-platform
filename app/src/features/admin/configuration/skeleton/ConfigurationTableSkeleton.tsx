import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { GridColDef } from '@mui/x-data-grid';

interface IConfigurationTableSkeletonProps {
  columns: Pick<GridColDef, 'field' | 'width' | 'minWidth' | 'flex'>[];
  rowCount?: number;
  hideFooter?: boolean;
}

/**
 * Preserve Configuration table column widths, header, rows, and pagination while data loads.
 *
 * @param props Column dimensions and the number of placeholder rows.
 * @returns A loading table aligned with the corresponding data grid.
 */
export const ConfigurationTableSkeleton = ({
  columns,
  rowCount = 3,
  hideFooter = false
}: IConfigurationTableSkeletonProps) => {
  return (
    <Box aria-label="Loading table" aria-busy="true" sx={{ overflow: 'hidden' }}>
      {Array.from({ length: rowCount + 1 }, (_, index) => (
        <Stack
          key={index}
          direction="row"
          sx={{ height: index === 0 ? 56 : 52, borderBottom: 1, borderColor: 'divider' }}>
          {columns.map((column) => (
            <Box
              key={column.field}
              sx={{
                boxSizing: 'border-box',
                width: column.width ?? 100,
                minWidth: column.minWidth,
                flex: column.flex,
                px: 2,
                display: 'flex',
                alignItems: 'center'
              }}>
              <Skeleton width="75%" />
            </Box>
          ))}
        </Stack>
      ))}
      {!hideFooter && (
        <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={3} sx={{ height: 52, px: 2 }}>
          <Skeleton width={120} />
          <Skeleton width={80} />
          <Skeleton width={64} />
        </Stack>
      )}
    </Box>
  );
};
