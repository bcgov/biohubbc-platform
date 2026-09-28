import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PropertyValueDisplay } from 'components/property/PropertyValueDisplay';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IFeaturePropertyRow } from 'interfaces/useFeaturesApi.interface';
import { useMemo } from 'react';
import { buildSubmissionPropertyValuePathResolvers } from 'utils/routes';
import { formatSubmissionPropertyValue } from 'utils/search-result-utils';

interface SecurityFeaturePropertiesTableProps {
  submissionId: number;
  submissionUploadId: string;
  submissionFeatureId: number;
}

/**
 * Renders paginated property values for one focused review feature.
 *
 * @param {SecurityFeaturePropertiesTableProps} props - Security feature properties table properties.
 * @returns {JSX.Element} Rendered security feature properties table.
 */
export const SecurityFeaturePropertiesTable = (props: SecurityFeaturePropertiesTableProps) => {
  const api = useApi();
  const propertyGrid = useServerPaginatedDataGrid({
    fetcher: (_search, pagination) =>
      api.admin.getSubmissionUploadFeatureProperties(
        props.submissionId,
        props.submissionUploadId,
        props.submissionFeatureId,
        pagination
      ),
    extractData: (response) => response.properties,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'property', sort: 'asc' }
  });
  const paths = useMemo(() => buildSubmissionPropertyValuePathResolvers('/submission', ''), []);
  const columns = useMemo<GridColDef<IFeaturePropertyRow>[]>(
    () => [
      {
        field: 'property',
        headerName: 'Property',
        flex: 0.3,
        renderCell: ({ value }) => <span style={{ textTransform: 'capitalize' }}>{value}</span>
      },
      {
        field: 'value',
        headerName: 'Value',
        flex: 0.7,
        renderCell: ({ row }) => (
          <Typography variant="body2" noWrap title={formatSubmissionPropertyValue(row.value)} sx={{ width: '100%' }}>
            <PropertyValueDisplay value={row.value} submissionId={props.submissionId} pathResolvers={paths} />
          </Typography>
        )
      }
    ],
    [paths, props.submissionId]
  );

  return (
    <CustomDataGrid
      autoHeight
      rows={propertyGrid.rows}
      columns={columns}
      getRowId={(row) => row.id}
      loading={propertyGrid.isLoading && !propertyGrid.response}
      noRowsMessage="No properties"
      paginationMode="server"
      paginationModel={propertyGrid.paginationModel}
      onPaginationModelChange={propertyGrid.handlePaginationChange}
      pageSizeOptions={[10, 25, 50]}
      rowCount={propertyGrid.rowCount}
      sortingMode="server"
      sortModel={propertyGrid.sortModel}
      onSortModelChange={propertyGrid.handleSortChange}
      rowSelection={false}
    />
  );
};
