import { Link, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { DataGrid, GridColDef, GridRenderCellParams, GridTreeNodeWithRender } from '@mui/x-data-grid';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { SYSTEM_ROLE } from 'constants/roles';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useKeycloakWrapper from 'hooks/useKeycloakWrapper';
import { IRelatedDataset } from 'interfaces/useDatasetApi.interface';
import { ensureProtocol } from 'utils/Utils';

const VALID_SYSTEM_ROLES: SYSTEM_ROLE[] = [SYSTEM_ROLE.DATA_ADMINISTRATOR, SYSTEM_ROLE.SYSTEM_ADMIN];

export interface IRelatedDatasetsProps {
  datasetId: string;
}

const NoDatasetRowsOverlay = () => (
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
);

/**
 * Dataset attachments content for a dataset.
 *
 * @return {*}
 */
const RelatedDatasets: React.FC<IRelatedDatasetsProps> = (props) => {
  const { datasetId } = props;

  const biohubApi = useApi();
  const keycloakWrapper = useKeycloakWrapper();

  const relatedDatasetsDataLoader = useDataLoader(() => biohubApi.dataset.getRelatedDatasets(datasetId));
  relatedDatasetsDataLoader.load();

  console.log('relatedDatasetsDataLoader:', relatedDatasetsDataLoader);

  const relatedDatasetsList: IRelatedDataset[] = relatedDatasetsDataLoader.data?.datasetsWithSupplementaryData || [];

  console.log('relatedDatasetsList:', relatedDatasetsList);
  const hasAdministrativePermissions = keycloakWrapper.hasSystemRole(VALID_SYSTEM_ROLES);

  const columns: GridColDef<IRelatedDataset>[] = [
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<IRelatedDataset, any, any, GridTreeNodeWithRender>) => {
        return <Link href={ensureProtocol(params.row.url)}>{params.row.title}</Link>;
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      renderCell: (params) => {
        const { supplementaryData } = params.row;

        if (hasAdministrativePermissions) {
          if (supplementaryData.isPendingReview === true) {
            return <Chip color="info" sx={{ textTransform: 'uppercase' }} label="Pending Review" />;
          }
        }
        return <></>;
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
              noRowsOverlay: NoDatasetRowsOverlay
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
