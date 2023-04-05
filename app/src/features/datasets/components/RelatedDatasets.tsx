import { Link, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { DataGrid, GridColDef, GridRenderCellParams, GridTreeNodeWithRender } from '@mui/x-data-grid';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IRelatedDataset } from 'interfaces/useDatasetApi.interface';

export interface IRelatedDatasetsProps {
  datasetId: string;
}

/**
 * Dataset attachments content for a dataset.
 *
 * @return {*}
 */
const RelatedDatasets: React.FC<IRelatedDatasetsProps> = (props) => {
  const { datasetId } = props;

  const biohubApi = useApi();

  const relatedDatasetsDataLoader = useDataLoader(() => biohubApi.dataset.getRelatedDatasets(datasetId));
  relatedDatasetsDataLoader.load();

  const relatedDatasetsList: IRelatedDataset[] = relatedDatasetsDataLoader.data?.datasets || [];

  const columns: GridColDef<IRelatedDataset>[] = [
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<IRelatedDataset, any, any, GridTreeNodeWithRender>) => {
        return <Link href={params.row.url}>{params.row.title}</Link>;
      }
    }
  ];

  return (
    <>
      <ActionToolbar label="Related Datasets" labelProps={{ variant: 'h4' }} />
      <Divider></Divider>
      <Box px={2}>
        <Box>
          <DataGrid
            getRowId={(row) => row.datasetId}
            autoHeight
            disableVirtualization
            rows={relatedDatasetsList}
            slots={{
              noRowsOverlay: () => (
                <Box
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexFlow: 'column',
                    alignItems: 'center',
                    top: '50%',
                    position: 'relative',
                    transform: 'translateY(-50%)'
                  }}>
                  <Typography component="strong" color="textSecondary" variant="body2">
                    No Related Datasets
                  </Typography>
                </Box>
              )
            }}
            columns={columns}
            pageSizeOptions={[5]}
            disableRowSelectionOnClick
            disableColumnSelector
            disableColumnFilter
            disableColumnMenu
            sortingOrder={['asc', 'desc']}
            initialState={{
              sorting: {
                sortModel: [{ field: 'create_date', sort: 'desc' }]
              },
              pagination: {
                paginationModel: {
                  pageSize: 5
                }
              }
            }}
          />
        </Box>
      </Box>
    </>
  );
};

export default RelatedDatasets;
