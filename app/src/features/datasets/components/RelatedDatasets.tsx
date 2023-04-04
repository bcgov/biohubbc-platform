import { mdiLockPlus, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Link } from '@mui/material';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import { DataGrid, GridColDef, GridRenderCellParams, GridTreeNodeWithRender } from '@mui/x-data-grid';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IRelatedDataset } from 'interfaces/useDatasetApi.interface';
import { useState } from 'react';
// import { Link as RouterLink } from 'react-router-dom'

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
  const [selected, setSelected] = useState<number[]>([]);

  const biohubApi = useApi();

  const relatedDatasetsDataLoader = useDataLoader(() => biohubApi.dataset.getRelatedDatasets(datasetId));
  relatedDatasetsDataLoader.load();

  const relatedDatasetsList = relatedDatasetsDataLoader.data?.datasets || [];

  const columns: GridColDef<IRelatedDataset>[] = [
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<IRelatedDataset, any, any, GridTreeNodeWithRender>) => {
        return (
          <Link href={params.row.url}>{params.row.title}</Link>
        )
      }
    }
  ];

  return (
    <>
      <ActionToolbar label="Related Datasets" labelProps={{ variant: 'h4' }}>
        <Box display="flex" gap={1}>
          <Button
            title="Apply Security Rules"
            variant="contained"
            color="primary"
            startIcon={<Icon path={mdiLockPlus} size={1} />}
            onClick={() => console.log('Apply Security not implemented.')}
            disabled={selected.length === 0}>
            Apply Security
          </Button>
          <IconButton disabled title="Download Files" aria-label={`Download selected files`}>
            <Icon path={mdiTrayArrowDown} color="primary" size={1} />
          </IconButton>
        </Box>
      </ActionToolbar>
      <Divider></Divider>
      <Box px={1}>
        <Box>
          <DataGrid
            getRowId={(row) => row.datasetId}
            autoHeight
            rows={relatedDatasetsList}
            columns={columns}
            pageSizeOptions={[5]}
            checkboxSelection
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
            onStateChange={(params) => setSelected(params.rowSelection)}
          />
        </Box>
      </Box>
    </>
  );
};

export default RelatedDatasets;
