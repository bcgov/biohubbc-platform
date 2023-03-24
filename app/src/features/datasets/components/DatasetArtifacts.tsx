import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { DataGrid, GridColDef, GridValueGetterParams } from "@mui/x-data-grid"
import { useApi } from "hooks/useApi";
import useDataLoader from "hooks/useDataLoader";
import { getFormattedFileSize } from "utils/Utils";

export interface IDatasetAttachmentsProps {
  datasetId: string;
}

const columns: GridColDef[] = [
  {
    field: 'file_name',
    headerName: 'Title'
  },
  {
    field: 'file_type',
    headerName: 'Type'
  },
  {
    field: 'submitted',
    headerName: 'Submitted'
  },
  {
    field: 'file_size',
    headerName: 'Size',
    valueGetter: (params: GridValueGetterParams) => getFormattedFileSize(params.row.file_size)
  }
];

/**
 * Project attachments content for a project.
 *
 * @return {*}
 */
const DatasetAttachments: React.FC<IDatasetAttachmentsProps> = (props) => {
  const { datasetId } = props;

  const biohubApi = useApi();
  const artifactsDataLoader = useDataLoader(() => biohubApi.dataset.getDatasetAttachments(datasetId));

  artifactsDataLoader.load();

  const artifactsList = artifactsDataLoader.data?.artifacts || [];

  return (
    <>
      <Toolbar style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h4" component="h2">
          Documents
        </Typography>
      </Toolbar>
      <Divider></Divider>
      <Box px={1}>
        <Box>
          <DataGrid
            rows={artifactsList.map((artifact) => ({ ...artifact, id: artifact.artifact_id }))}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: {
                  pageSize: 5,
                },
              },
            }}
            pageSizeOptions={[5]}
            checkboxSelection
            disableRowSelectionOnClick
          />
        </Box>
      </Box>
    </>
  );
};

export default DatasetAttachments;
