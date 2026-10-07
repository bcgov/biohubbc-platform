import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PropertyValueDisplay } from 'components/property/PropertyValueDisplay';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
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
  const propertyGrid = useServerPaginatedGridState({ defaultSort: { field: 'property', sort: 'asc' } });
  const propertiesQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureProperties(props, props.submissionFeatureId, propertyGrid.apiPagination),
    queryFn: ({ signal }) =>
      api.admin.getSubmissionUploadFeatureProperties(
        props.submissionId,
        props.submissionUploadId,
        props.submissionFeatureId,
        propertyGrid.apiPagination,
        { signal }
      ),
    placeholderData: keepPreviousData
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
      rows={propertiesQuery.data?.properties ?? []}
      columns={columns}
      getRowId={(row) => row.id}
      loading={propertiesQuery.isFetching && !propertiesQuery.data}
      noRowsMessage="No properties"
      paginationMode="server"
      paginationModel={propertyGrid.paginationModel}
      onPaginationModelChange={propertyGrid.handlePaginationChange}
      pageSizeOptions={[10, 25, 50]}
      rowCount={propertiesQuery.data?.pagination.total ?? 0}
      sortingMode="server"
      sortModel={propertyGrid.sortModel}
      onSortModelChange={propertyGrid.handleSortChange}
      rowSelection={false}
    />
  );
};
