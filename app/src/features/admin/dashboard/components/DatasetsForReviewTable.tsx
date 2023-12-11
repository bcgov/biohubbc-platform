import { CircularProgress, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { SubmissionRecord } from 'interfaces/useDatasetApi.interface';
import React from 'react';

const DatasetsForReviewTable: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();

  const unreviewedSubmissionsDataLoader = useDataLoader(() => biohubApi.dataset.getUnreviewedSubmissions());
  unreviewedSubmissionsDataLoader.load();

  const datasetList: SubmissionRecord[] = unreviewedSubmissionsDataLoader.data ?? [];
  const columns: GridColDef<SubmissionRecord>[] = [
    {
      field: 'submission_id',
      headerName: 'ID',
      flex: 1,
      disableColumnMenu: true
    },
    {
      field: 'uuid',
      headerName: 'UUID',
      flex: 1,
      disableColumnMenu: true
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 2,
      disableColumnMenu: true
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      disableColumnMenu: true
    },
    {
      field: 'create_date',
      headerName: 'Date Created',
      flex: 1,
      disableColumnMenu: true
    }
  ];

  return (
    <>
      {unreviewedSubmissionsDataLoader.isLoading && <CircularProgress className="pageProgress" size={40} />}
      {datasetList.length === 0 && !unreviewedSubmissionsDataLoader.isLoading && (
        <Box
          sx={{
            p: 3,
            m: 1,
            display: 'flex',
            flexFlow: 'column',
            alignItems: 'center',
            position: 'relative',
            border: '1pt solid #dadada',
            borderRadius: '4px'
          }}>
          <Typography
            data-testid="no-security-reviews"
            component="strong"
            color="textSecondary"
            variant="body1"
            fontWeight={'bold'}>
            No Pending Security Reviews
          </Typography>
        </Box>
      )}
      {datasetList.length > 0 && !unreviewedSubmissionsDataLoader.isLoading && (
        <DataGrid
          sx={{ borderTop: '1pt solid #dadada', borderBottom: '1pt solid #dadada' }}
          data-testid="security-reviews-data-grid"
          getRowId={(row) => row.submission_id}
          autoHeight
          rows={datasetList}
          columns={columns}
          pageSizeOptions={[5]}
          disableRowSelectionOnClick
          disableColumnSelector
          disableColumnMenu
          hideFooter
          sortingOrder={['asc', 'desc']}
          initialState={{
            sorting: { sortModel: [{ field: 'last_updated', sort: 'desc' }] },
            pagination: {
              paginationModel: {
                pageSize: 5
              }
            }
          }}
        />
      )}
    </>
  );
};

export default DatasetsForReviewTable;
