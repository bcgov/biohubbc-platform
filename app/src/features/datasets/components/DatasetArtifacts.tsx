import { mdiLockPlus, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { SYSTEM_ROLE } from 'constants/roles';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useKeycloakWrapper from 'hooks/useKeycloakWrapper';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import { useState } from 'react';
import { downloadFile, getFormattedDate, getFormattedFileSize } from 'utils/Utils';
import AttachmentItemMenuButton from './AttachmentItemMenuButton';
import ApplySecurityDialog from './security/ApplySecurityDialog';

const VALID_SYSTEM_ROLES: SYSTEM_ROLE[] = [SYSTEM_ROLE.DATA_ADMINISTRATOR, SYSTEM_ROLE.SYSTEM_ADMIN];

export interface IDatasetAttachmentsProps {
  datasetId: string;
}

const NoArtifactRowsOverlay = () => (
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
      No Artifacts
    </Typography>
  </Box>
);

/**
 * Dataset attachments content for a dataset.
 *
 * @return {*}
 */
const DatasetAttachments: React.FC<IDatasetAttachmentsProps> = (props) => {
  const { datasetId } = props;
  const [showAlert, setShowAlert] = useState<boolean>(true);

  const [openApplySecurity, setOpenApplySecurity] = useState<boolean>(false);
  const [selectedArtifacts, setSelectedArtifacts] = useState<IArtifact[]>([]);

  const keycloakWrapper = useKeycloakWrapper();
  const biohubApi = useApi();

  const artifactsDataLoader = useDataLoader(() => biohubApi.dataset.getDatasetArtifacts(datasetId));
  artifactsDataLoader.load();

  const artifactsList = artifactsDataLoader.data?.artifacts || [];
  const numPendingDocuments = artifactsList.filter((artifact) => artifact.security_review_timestamp === null).length;
  const hasAdministrativePermissions = keycloakWrapper.hasSystemRole(VALID_SYSTEM_ROLES);

  const handleDownloadAttachment = async (attachment: IArtifact) => {
    const signedUrl = await biohubApi.dataset.getArtifactSignedUrl(attachment.artifact_id);
    if (!signedUrl) {
      return;
    }

    await downloadFile(signedUrl);
  };

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
        if (!security_review_timestamp && hasAdministrativePermissions) {
          return <Chip color="info" sx={{ textTransform: 'uppercase' }} label="Pending Review" />;
        }

        return <Chip color="warning" sx={{ textTransform: 'uppercase' }} label="Secured" />;
      }
    },
    {
      field: 'action',
      headerName: 'Action',
      sortable: false,
      renderCell: (params) => {
        return (
          <AttachmentItemMenuButton
            artifact={params.row}
            onDownload={handleDownloadAttachment}
            isPendingReview={!params.row.security_review_timestamp}
            hasAdministrativePermissions={hasAdministrativePermissions}
          />
        );
      }
    }
  ];

  return (
    <>
      <ApplySecurityDialog
        selectedArtifacts={selectedArtifacts}
        open={openApplySecurity}
        onClose={() => setOpenApplySecurity(false)}
      />

      <ActionToolbar label="Documents" labelProps={{ variant: 'h4' }}>
        <Box display="flex" gap={1}>
          <Button
            title="Apply Security Rules"
            variant="contained"
            color="primary"
            startIcon={<Icon path={mdiLockPlus} size={1} />}
            onClick={() => setOpenApplySecurity(true)}
            disabled={selectedArtifacts.length > 0 ? false : true}>
            Apply Security
          </Button>
          <IconButton disabled title="Download Files" aria-label={`Download selected files`}>
            <Icon path={mdiTrayArrowDown} color="primary" size={1} />
          </IconButton>
        </Box>
      </ActionToolbar>
      <Divider></Divider>
      <Box px={2}>
        {hasAdministrativePermissions && numPendingDocuments > 0 && showAlert && (
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
            slots={{
              noRowsOverlay: NoArtifactRowsOverlay
            }}
            onRowSelectionModelChange={(params) => {
              const selectedArtifacts = params.map((rowId) => {
                const findArtifact = artifactsList.find((artifact) => artifact.artifact_id === rowId);
                if (findArtifact === undefined) {
                  throw Error('Artifact not found');
                } else {
                  return findArtifact;
                }
              });

              if (selectedArtifacts) {
                setSelectedArtifacts(selectedArtifacts);
              }
            }}
          />
        </Box>
      </Box>
    </>
  );
};

export default DatasetAttachments;
