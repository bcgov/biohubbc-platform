import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { GridColDef, GridPaginationModel, GridRowParams, GridSortModel, MuiEvent } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';

export type SubmissionFeatureRow = {
  submissionFeatureId: number;
  submission_feature_id: number;
  feature_type_name: string;
};

const columns: GridColDef[] = [
  { field: 'submission_feature_id', headerName: 'ID', width: 120, sortable: true },
  { field: 'feature_type_name', headerName: 'Feature Type', flex: 1, sortable: true }
];

interface SubmissionFeatureTableProps {
  rows: SubmissionFeatureRow[];
  rowCount: number;
  isLoading: boolean;
  onRowClick: (params: GridRowParams<SubmissionFeatureRow>, event: MuiEvent<React.MouseEvent>) => void;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  onSortModelChange: (model: GridSortModel) => void;
}

export const SubmissionFeatureTable = (props: SubmissionFeatureTableProps) => {
  const {
    rows,
    rowCount,
    isLoading,
    onRowClick,
    paginationModel,
    onPaginationModelChange,
    sortModel,
    onSortModelChange
  } = props;

  return (
    <Paper sx={{ my: 3 }}>
      <Stack gap={2} py={2}>
        <Box px={2}>
          <Typography variant="h4">
            Features{' '}
            <Typography component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </Typography>
        </Box>

        <CustomDataGrid
          autoHeight
          rows={rows}
          rowCount={rowCount}
          onRowClick={onRowClick}
          columns={columns}
          getRowId={(row) => row.submission_feature_id}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          noRowsMessage="No features found for this submission."
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={onPaginationModelChange}
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={onSortModelChange}
        />
      </Stack>
    </Paper>
  );
};
