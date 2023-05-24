import { CircularProgress, Link, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import { DataGrid, GridColDef, GridRenderCellParams, GridTreeNodeWithRender } from '@mui/x-data-grid';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IDatasetForReview } from 'interfaces/useDatasetApi.interface';
import { ensureProtocol } from 'utils/Utils';

const DashboardPage = () => {
  const biohubApi = useApi();
  const unsecuredDatasetDataLoader = useDataLoader(() => biohubApi.dataset.listAllDatasetsForReview());
  unsecuredDatasetDataLoader.load();

  const datasetList: IDatasetForReview[] = unsecuredDatasetDataLoader.data || [];
  const columns: GridColDef<IDatasetForReview>[] = [
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
      renderCell: (params: GridRenderCellParams<IDatasetForReview, any, any, GridTreeNodeWithRender>) => {
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
      renderCell: (params: GridRenderCellParams<IDatasetForReview, any, any, GridTreeNodeWithRender>) => {
        if (params.row.dataset_type.toUpperCase() === 'PROJECT') {
          return <Chip color="info" sx={{ textTransform: 'uppercase' }} label="INVENTORY PROJECT" />;
        }
        return <></>;
      }
    },
    {
      field: 'last_updated',
      headerName: 'LAST UPDATED',
      flex: 1,
      disableColumnMenu: true
    }
  ];

  return (
    <Box>
      <Paper
        square
        elevation={0}
        sx={{
          py: 7
        }}>
        <Container maxWidth="xl">
          <Typography
            variant="h1"
            sx={{
              mt: -2,
              mb: 4
            }}>
            Dashboard
          </Typography>
          <Typography
            variant="h3"
            sx={{
              mt: 6,
              mb: 4
            }}>
            Pending Security Reviews
          </Typography>
          <Divider />
        </Container>
      </Paper>
      <Container maxWidth="xl">
        <Box>
          {unsecuredDatasetDataLoader.isLoading && <CircularProgress className="pageProgress" size={40} />}
          {datasetList.length == 0 && !unsecuredDatasetDataLoader.isLoading && (
            <Box
              sx={{
                p: 2,
                display: 'flex',
                flexFlow: 'column',
                alignItems: 'center',
                top: '50%',
                position: 'relative',
                border: '1pt solid #dadada',
                borderRadius: '4px'
              }}>
              <Typography component="strong" color="textSecondary" variant="body1" fontWeight={'bold'}>
                No Pending Security Reviews
              </Typography>
            </Box>
          )}
          {datasetList.length > 0 && !unsecuredDatasetDataLoader.isLoading && (
            <DataGrid
              getRowId={(row) => row.dataset_id}
              autoHeight
              rows={datasetList}
              columns={columns}
              pageSizeOptions={[5]}
              disableRowSelectionOnClick
              disableColumnSelector
              disableColumnMenu
              hideFooterPagination
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
        </Box>
      </Container>
    </Box>
  );
};

export default DashboardPage;
