import Box from '@mui/material/Box';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { jsonStringifyObjectProperties } from 'utils/Utils';

interface SubmissionFeaturePropertiesProps {
  data: Record<string, any>;
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

export const SubmissionFeatureProperties = ({ data }: SubmissionFeaturePropertiesProps) => {
  const stringifiedProperties = jsonStringifyObjectProperties(data);

  const rows = Object.entries(stringifiedProperties).map(([key, value]) => ({
    id: key,
    property: key.replaceAll('_', ' '),
    value: value ?? ''
  }));

  return (
    <Box>
      <CustomDataGrid
        rows={rows}
        columns={columns}
        noRowsMessage="No properties"
        autoHeight
        hideFooter
        rowSelection={false}
      />
    </Box>
  );
};
