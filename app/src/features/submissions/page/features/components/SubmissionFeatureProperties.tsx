import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { jsonStringifyObjectProperties } from 'utils/Utils';

interface SubmissionFeaturePropertiesProps {
  data: Record<string, any>;
  isLoading?: boolean;
}

const columns: GridColDef[] = [
  {
    field: 'property',
    headerName: 'Property',
    flex: 0.3,
    renderCell: (params) => <strong style={{ textTransform: 'capitalize' }}>{params.value}</strong>
  },
  {
    field: 'value',
    headerName: 'Value',
    flex: 0.7
  }
];

type PropertyRow = { id: string; property: string; value: string };

export const SubmissionFeatureProperties = ({ data, isLoading }: SubmissionFeaturePropertiesProps) => {
  let rows: PropertyRow[] = [];

  if (!isLoading) {
    const stringifiedProperties = jsonStringifyObjectProperties(data);

    rows = Object.entries(stringifiedProperties).map(([key, value]) => ({
      id: key,
      property: key.replace(/_/g, ' '),
      value: value ?? ''
    }));
  }

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Box p={3}>
        <Typography variant="h2" component="h2" mb={2}>
          Properties
        </Typography>
        <CustomDataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          noRowsMessage="No properties"
          autoHeight
          hideFooter
        />
      </Box>
    </Paper>
  );
};
