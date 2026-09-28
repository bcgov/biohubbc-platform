import { Box, Stack, Typography } from '@mui/material';
import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { SecurityReviewFeaturesTable } from './table/SecurityReviewFeaturesTable';
import { FeatureRow } from './table/SecurityReviewFeaturesTable.interface';

interface SecurityReviewFeaturesProps {
  rows: FeatureRow[];
  rowCount: number;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  setSortModel: (model: GridSortModel) => void;
}

/**
 * Displays paginated submission features and their security status.
 * @param {SecurityReviewFeaturesProps} props Feature rows and paging controls.
 * @returns {JSX.Element} Read-only feature section.
 */
export const SecurityReviewFeatures = ({
  rows,
  rowCount,
  paginationModel,
  setPaginationModel,
  sortModel,
  setSortModel
}: SecurityReviewFeaturesProps) => {
  return (
    <Stack gap={2} py={2}>
      <Box px={2}>
        <Typography variant="h4">
          Features{' '}
          <Typography component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </Typography>
      </Box>

      <SecurityReviewFeaturesTable
        rows={rows}
        rowCount={rowCount}
        paginationModel={paginationModel}
        setPaginationModel={setPaginationModel}
        sortModel={sortModel}
        setSortModel={setSortModel}
      />
    </Stack>
  );
};
