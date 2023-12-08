import { CircularProgress, Link, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { DataGrid, GridColDef, GridRenderCellParams, GridTreeNodeWithRender } from '@mui/x-data-grid';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IUnreviewedSubmission } from 'interfaces/useDatasetApi.interface';
import React from 'react';
import { ensureProtocol } from 'utils/Utils';

const DatasetsForReviewTable: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();
  const unsecuredDatasetDataLoader = useDataLoader(() => biohubApi.dataset.getUnreviewedSubmissions());
  unsecuredDatasetDataLoader.load();

  const datasetList: IUnreviewedSubmission[] = unsecuredDatasetDataLoader.data ?? [];
  const columns: GridColDef<IUnreviewedSubmission>[] = [
    {
      field: 'artifacts_to_review',
      headerName: 'FILES TO REVIEW',
      flex: 1,
      disableColumnMenu: true
    },
    {
      field: 'dataset_name',
      headerName: 'TITLE',
      flex: 2,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<IUnreviewedSubmission, any, any, GridTreeNodeWithRender>) => {
        return (
          <Link href={`${ensureProtocol(window.location.host)}/datasets/${params.row.dataset_id}/details`}>
            {params.row.dataset_name}
          </Link>
        );
      }
    },
    {
      field: 'dataset_type',
      headerName: 'TYPE',
      flex: 1,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<IUnreviewedSubmission, any, any, GridTreeNodeWithRender>) => {
        return params.row.keywords.map((item) => (
          <Chip
            key={params.row.dataset_id}
            color="primary"
            style={{ backgroundColor: '#d9eaf7', color: 'black', fontSize: '10px' }}
            sx={{ textTransform: 'uppercase' }}
            label={prepKeyword(item)}
          />
        ));
      }
    },
    {
      field: 'last_updated',
      headerName: 'LAST UPDATED',
      flex: 1,
      disableColumnMenu: true
    }
  ];

  const prepKeyword = (keyword: string): string => {
    let prep = keyword.toUpperCase();
    if (prep === 'PROJECT') {
      prep = 'INVENTORY PROJECT';
    }
    return prep;
  };

  return (
    <>
      {unsecuredDatasetDataLoader.isLoading && <CircularProgress className="pageProgress" size={40} />}
      {datasetList.length === 0 && !unsecuredDatasetDataLoader.isLoading && (
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
      {datasetList.length > 0 && !unsecuredDatasetDataLoader.isLoading && (
        <DataGrid
          sx={{ borderTop: '1pt solid #dadada', borderBottom: '1pt solid #dadada' }}
          data-testid="security-reviews-data-grid"
          getRowId={(row) => row.dataset_id}
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
