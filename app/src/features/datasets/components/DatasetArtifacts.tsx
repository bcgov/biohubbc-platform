import { mdiChevronDown, mdiDotsVertical } from "@mdi/js";
import Icon from "@mdi/react";
import { Alert, Chip } from "@mui/material";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from '@mui/material/IconButton';
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { DataGrid, GridColDef } from "@mui/x-data-grid"
import { useApi } from "hooks/useApi";
import useDataLoader from "hooks/useDataLoader";
import { useState } from "react";
import { getFormattedFileSize } from "utils/Utils";

export interface IDatasetAttachmentsProps {
  datasetId: string;
}

const columns: GridColDef[] = [
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
    field: 'submitted',
    headerName: 'Submitted',
    flex: 1
  },
  {
    field: 'file_size',
    headerName: 'Size',
    flex: 0,
    renderCell: (params) => <>{getFormattedFileSize(params.row.file_size)}</>
  },
  {
    field: 'status',
    headerName: 'Status',
    flex: 1,
    renderCell: (params) => {
      return (
        <Chip
          color='info'
          sx={{ textTransform: 'uppercase' }}
          label="Pending Review"
          onDelete={() => {}}
          deleteIcon={<Icon path={mdiChevronDown} size={1} />}
        />
      )
    }
  },
  {
    field: 'action',
    headerName: 'Action',
    sortable: false,
    renderCell: (() => {
      return (
        <IconButton>
          <Icon path={mdiDotsVertical} size={1}/>
        </IconButton>
      );
    })
  },

];

/**
 * Project attachments content for a project.
 *
 * @return {*}
 */
const DatasetAttachments: React.FC<IDatasetAttachmentsProps> = (props) => {
  const { datasetId } = props;
  const [showAlert, setShowAlert] = useState<boolean>(true);

  const biohubApi = useApi();
  const artifactsDataLoader = useDataLoader(() => biohubApi.dataset.getDatasetAttachments(datasetId));

  artifactsDataLoader.load();

  const artifactsList = artifactsDataLoader.data?.artifacts || [];

  const rows = artifactsList.map((artifact) => ({ ...artifact, id: artifact.artifact_id }));

  console.log({ rows })

  const hasPendingDocuments = true // artifactsList.some((artifact) => artifact.status === 'PENDING_REVIEW');

  return (
    <>
      <Toolbar style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h4" component="h2">
          Documents
        </Typography>
      </Toolbar>
      <Divider></Divider>
      <Box px={1}>
        {hasPendingDocuments && showAlert && (
          <Box pt={2} pb={2}>
              <Alert onClose={() => setShowAlert(false)} severity='info'>
                <strong>You have 5 project documents to review.</strong>
              </Alert>    
          </Box>  
        )}
        <Box>
          <DataGrid
            autoHeight
            rows={rows}
            columns={columns}
            pageSizeOptions={[5]}
            checkboxSelection
            disableRowSelectionOnClick
            disableColumnSelector
            disableColumnFilter
            disableColumnMenu
            sortingOrder={['asc', 'desc']}
            sx={{
              border: 0,
              '& .MuiDataGrid-columnHeader': {
                textTransform: 'uppercase',
                fontWeight: 700
              },
              '& .MuiDataGrid-cell:focus-within, & .MuiDataGrid-cellCheckbox:focus-within, & .MuiDataGrid-columnHeader:focus-within': {
                outline: 'none'
              },
            }}
            initialState={{
              sorting: {
                sortModel: [{ field: 'submitted', sort: 'desc' }]
              },
              pagination: {
                paginationModel: {
                  pageSize: 5,
                },
              },
            }}
          />
        </Box>
      </Box>
    </>
  );
};

export default DatasetAttachments;
