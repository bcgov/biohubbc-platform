import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { SubmissionFeatureTableProps } from './SubmissionFeatureTable.interface';

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

  const columns: GridColDef[] = [
    { field: 'submission_feature_id', headerName: 'ID', width: 120, sortable: true },
    { field: 'feature_type_name', headerName: 'Feature Type', flex: 1, sortable: true }
  ];

  return (
    <PageSection
      id="submission-features"
      label={
        <>
          Features{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </>
      }>
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
    </PageSection>
  );
};
