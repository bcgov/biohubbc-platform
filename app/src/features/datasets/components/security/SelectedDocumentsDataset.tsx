import { Paper } from '@mui/material';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { IArtifact } from 'interfaces/useDatasetApi.interface';

export interface IRelatedDatasetsProps {
  selectedArtifacts: IArtifact[];
}

/**
 * Selected Documents Dataset for security application.
 *
 * @return {*}
 */
const SelectedDocumentsDataset: React.FC<IRelatedDatasetsProps> = (props) => {
  const { selectedArtifacts } = props;
  console.log('selectedArtifacts', selectedArtifacts);

  const columns: GridColDef<IArtifact>[] = [
    {
      field: 'file_type',
      headerName: 'Type',
      flex: 1
    },
    {
      field: 'file_name',
      headerName: 'Title',
      flex: 2,
      disableColumnMenu: true
    }
  ];

  return (
    <>
      <Paper elevation={3}>
        <ActionToolbar label={`Selected Documents (${selectedArtifacts.length})`} labelProps={{ variant: 'h4' }} />
        <Divider></Divider>
        <Box px={2}>
          <Box>
            <DataGrid
              getRowId={(row) => row.artifact_id}
              autoHeight
              disableVirtualization
              rows={selectedArtifacts}
              columns={columns}
              disableRowSelectionOnClick
              disableColumnSelector
              disableColumnFilter
              disableColumnMenu
              disableDensitySelector
              hideFooter
            />
          </Box>
        </Box>
      </Paper>
    </>
  );
};

export default SelectedDocumentsDataset;
