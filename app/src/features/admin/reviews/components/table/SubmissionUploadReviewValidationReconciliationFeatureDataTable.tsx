import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { PAGE_SIZE_OPTIONS } from 'constants/pagination';
import { IServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ReconciliationFeatureData } from 'interfaces/useAdminApi.interface';
import { useMemo } from 'react';

interface SubmissionUploadReviewValidationReconciliationFeatureDataTableProps {
  features: ReconciliationFeatureData[];
  rowCount: number;
  grid: IServerPaginatedGridState;
  isLoading: boolean;
  hasError: boolean;
}

/**
 * Display one server-paginated page of an outcome's features with their raw submitted jsonb in a Features section.
 * The grid stays mounted while loading, so another page only changes the rows it is given.
 * @param {SubmissionUploadReviewValidationReconciliationFeatureDataTableProps} props Raw feature data, pagination and
 * request state.
 * @returns {JSX.Element} Raw feature data table with loading and empty states.
 */
export const SubmissionUploadReviewValidationReconciliationFeatureDataTable = ({
  features,
  rowCount,
  grid,
  isLoading,
  hasError
}: SubmissionUploadReviewValidationReconciliationFeatureDataTableProps) => {
  const columns = useMemo<GridColDef<ReconciliationFeatureData>[]>(
    () => [
      {
        field: 'submission_feature_id',
        headerName: 'ID',
        type: 'number',
        width: 120,
        align: 'left',
        headerAlign: 'left'
      },
      {
        field: 'data',
        headerName: 'Data',
        flex: 1,
        minWidth: 360,
        sortable: false,
        renderCell: (params) => (
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              m: 0
            }}>
            {JSON.stringify(params.row.data, null, 2)}
          </Box>
        )
      }
    ],
    []
  );

  return (
    <PageSection
      id="reconciliation-features"
      label={
        <>
          Features{' '}
          <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
            ({rowCount})
          </Typography>
        </>
      }>
      <CustomDataGrid
        autoHeight
        rows={features}
        columns={columns}
        rowCount={rowCount}
        loading={isLoading}
        paginationMode="server"
        sortingMode="server"
        paginationModel={grid.paginationModel}
        onPaginationModelChange={grid.handlePaginationChange}
        sortModel={grid.sortModel}
        onSortModelChange={grid.handleSortChange}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        getRowId={(row) => row.submission_feature_id}
        getRowHeight={() => 'auto'}
        getEstimatedRowHeight={() => 160}
        noRowsMessage={hasError ? 'Unable to load features.' : 'No features found.'}
        disableRowSelectionOnClick
        disableColumnSelector
        disableColumnMenu
        sx={{
          '& .MuiDataGrid-cell': {
            alignItems: 'flex-start',
            py: 1.5
          },
          // Overrides the grid's single-line cell content so the pretty-printed JSON keeps its line breaks.
          '& .MuiDataGrid-cell[data-field="data"] > *': {
            overflow: 'visible',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }
        }}
      />
    </PageSection>
  );
};
