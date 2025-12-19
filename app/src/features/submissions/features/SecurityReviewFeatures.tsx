import { Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { SecurityReviewFeaturesTable } from './table/SecurityReviewFeaturesTable';

interface FeatureRow {
  id: number;
  submission_feature_id: number;
  feature_type_display_name: string;
  feature_type_name: string;
  secured: boolean;
}

interface SecurityReviewFeaturesProps {
  rows: FeatureRow[];
  rowCount: number;
  selectedFeatureIds: Set<number>;
  setSelectedFeatureIds: (ids: Set<number>) => void;
  paginationModel: any;
  setPaginationModel: (model: any) => void;
  sortModel: any;
  setSortModel: (model: any) => void;
  onRowClick: (params: any) => void;
  onRowSecurityClick: (row: FeatureRow) => void;
}

export const SecurityReviewFeatures = ({
  rows,
  rowCount,
  selectedFeatureIds,
  setSelectedFeatureIds,
  paginationModel,
  setPaginationModel,
  sortModel,
  setSortModel,
  onRowClick,
  onRowSecurityClick
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
        selectionModel={{ type: 'include', ids: selectedFeatureIds }}
        onSelectionChange={(newModel) => setSelectedFeatureIds(new Set([...newModel.ids].map(Number)))}
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
