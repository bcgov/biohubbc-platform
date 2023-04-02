import { mdiLockPlus, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, Button, Chip } from '@mui/material';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import { useState } from 'react';
import { getFormattedDate, getFormattedFileSize } from 'utils/Utils';

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
  const [showAlert, setShowAlert] = useState<boolean>(true);
  const [selected, setSelected] = useState<number[]>([]);

  const biohubApi = useApi();

  const artifactsDataLoader = useDataLoader(() => biohubApi.dataset.getDatasetArtifacts(datasetId));
  artifactsDataLoader.load();

  const artifactsList = artifactsDataLoader.data?.artifacts || [];
  const numPendingDocuments = artifactsList.filter((artifact) => artifact.security_review_timestamp === null).length;

  const columns: GridColDef<IArtifact>[] = [
    {
      field: 'file_name',
      headerName: 'Title',
      flex: 2,
      disableColumnMenu: true
    },
    {
      field: 'file_type',
      headerName: 'Type',
      flex: 1
    },
    {
      field: 'create_date',
      headerName: 'Submitted',
      valueGetter: ({ value }) => value && new Date(value),
      valueFormatter: ({ value }) => getFormattedDate(DATE_FORMAT.ShortDateFormat, value),
      flex: 1
    },
    {
      field: 'file_size',
      headerName: 'Size',
      flex: 0,
      valueFormatter: ({ value }) => getFormattedFileSize(value)
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      renderCell: (params) => {
        const { security_review_timestamp } = params.row;
        if (!security_review_timestamp) {
          return <Chip color="info" sx={{ textTransform: 'uppercase' }} label="Pending Review" />;
        }

        return <Chip color="success" sx={{ textTransform: 'uppercase' }} label="Unsecured" />;
      }
    },
    {
      field: 'action',
      headerName: 'Action',
      sortable: false,
      renderCell: (params) => {
        return (
          null
        );
      }
    }
  ];

  return (
    <>
      <ActionToolbar label="Documents" labelProps={{ variant: 'h4' }}>
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
        {numPendingDocuments > 0 && showAlert && (
          <Box pt={2} pb={2}>
            <Alert onClose={() => setShowAlert(false)} severity="info">
              <strong>
                {`You have ${numPendingDocuments} project document${numPendingDocuments === 1 ? '' : 's'} to review.`}
              </strong>
            </Alert>
          </Box>
        )}
        <Box>
          <DataGrid
            getRowId={(row) => row.artifact_id}
            autoHeight
            rows={artifactsList}
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
