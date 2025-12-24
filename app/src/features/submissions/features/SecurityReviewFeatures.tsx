import { Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { GridPaginationModel, GridRowParams, GridRowSelectionModel, GridSortModel } from '@mui/x-data-grid';
import { SecurityReviewFeaturesTable } from './table/SecurityReviewFeaturesTable';

interface SecurityReviewFeaturesProps {
  rows: FeatureRow[];
  rowCount: number;
  setSelectedFeatureIds: (ids: Set<number>) => void;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  setSortModel: (model: GridSortModel) => void;
  onRowClick: (params: GridRowParams<FeatureRow>) => void;
  onRowSecurityClick: (row: FeatureRow) => void;
}

export const SecurityReviewFeatures = ({
  rows,
  rowCount,
  setSelectedFeatureIds,
  paginationModel,
  setPaginationModel,
  sortModel,
  setSortModel,
  onRowClick,
  onRowSecurityClick
}: SecurityReviewFeaturesProps) => {
  const handleSelectionChange = (newSelection: GridRowSelectionModel) => {
    setSelectedFeatureIds(new Set([...newSelection.ids].map(Number)));
  };

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
        onSelectionChange={handleSelectionChange}
        paginationModel={paginationModel}
        setPaginationModel={setPaginationModel}
        sortModel={sortModel}
        setSortModel={setSortModel}
        onRowClick={onRowClick}
        onRowSecurityClick={onRowSecurityClick}
      />
    </Stack>
  );
};
