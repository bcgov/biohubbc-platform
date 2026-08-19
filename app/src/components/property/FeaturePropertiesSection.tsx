import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IFeaturePropertyRow, ISubmissionFeaturePropertiesResponse } from 'interfaces/useFeaturesApi.interface';
import { useMemo } from 'react';
import { formatSubmissionPropertyValue } from 'utils/search-result-utils';
import { PropertyValueDisplay } from './PropertyValueDisplay';

export interface FeaturePropertiesSectionProps {
  /** Submission the feature belongs to; with `submissionFeatureId`, selects the properties to load. */
  submissionId?: string;
  /** Feature whose indexed properties are listed. */
  submissionFeatureId?: string;
  /** Submission route base for reference-value links, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
}

/**
 * "Properties" section of the submission feature detail pages (public and portal).
 *
 * Lists the feature's canonical indexed properties from `GET .../features/{id}/properties` with server-side
 * search, sort and pagination, rendering each value via {@link PropertyValueDisplay} so reference values
 * (taxon) display their `label` as a link.
 *
 * @param {FeaturePropertiesSectionProps} props
 * @returns {JSX.Element}
 */
export const FeaturePropertiesSection = ({
  submissionId,
  submissionFeatureId,
  featureRouteBasePath
}: FeaturePropertiesSectionProps) => {
  const api = useApi();

  const columns = useMemo<GridColDef<IFeaturePropertyRow>[]>(
    () => [
      {
        field: 'property',
        headerName: 'Property',
        flex: 0.3,
        renderCell: (params) => <span style={{ textTransform: 'capitalize' }}>{params.value}</span>
      },
      {
        field: 'value',
        headerName: 'Value',
        flex: 0.7,
        renderCell: (params) => (
          <Typography
            variant="body2"
            noWrap
            title={formatSubmissionPropertyValue(params.row.value)}
            sx={{ width: '100%' }}>
            <PropertyValueDisplay
              value={params.row.value}
              submissionId={submissionId}
              featureRouteBasePath={featureRouteBasePath}
            />
          </Typography>
        )
      }
    ],
    [submissionId, featureRouteBasePath]
  );

  const propertyGrid = useServerPaginatedDataGrid<IFeaturePropertyRow, ISubmissionFeaturePropertiesResponse>({
    fetcher: async (search, pagination) => {
      if (!submissionId || !submissionFeatureId) {
        return {
          properties: [],
          pagination: {
            total: 0,
            current_page: 1,
            last_page: 1,
            per_page: pagination.limit
          }
        };
      }

      return api.features.getSubmissionFeatureProperties(submissionId, submissionFeatureId, {
        search,
        ...pagination
      });
    },
    extractData: (response) => response.properties,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'property', sort: 'asc' },
    defaultPageSize: 10
  });

  return (
    <PageSection
      id="submission-feature-properties"
      label="Properties"
      headerContent={
        <Stack gap={1} direction="row" alignItems="center">
          <TextField
            size="small"
            placeholder="Search by property or value"
            value={propertyGrid.searchTerm}
            onChange={(event) => propertyGrid.handleSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon path={mdiMagnify} size={0.875} />
                  </InputAdornment>
                )
              }
            }}
            sx={{ width: 250 }}
          />
        </Stack>
      }>
      <CustomDataGrid
        autoHeight
        rows={propertyGrid.rows}
        columns={columns}
        getRowId={(row) => row.id}
        loading={propertyGrid.isLoading}
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
    </PageSection>
  );
};
