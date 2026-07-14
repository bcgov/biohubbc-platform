import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PropertyValueDisplay } from 'components/property/PropertyValueDisplay';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IFeaturePropertyRow, ISubmissionFeaturePropertiesResponse } from 'interfaces/useFeaturesApi.interface';

interface FeaturePropertiesSectionProps {
  submissionId?: string;
  submissionFeatureId?: string;
  /** Route base for feature-reference links, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
  /** PageSection DOM id used for in-page anchors. */
  sectionId: string;
}

/**
 * Shared "Properties" section for the submission feature detail pages (public and portal).
 *
 * Sources the canonical indexed properties from `GET .../features/{id}/properties` with server-side
 * search and sort, and renders each value via {@link PropertyValueDisplay} so reference-typed values
 * (taxon, code, feature) display their `label` as a link/link-like element.
 *
 * @param {FeaturePropertiesSectionProps} props
 * @returns {JSX.Element}
 */
export const FeaturePropertiesSection = ({
  submissionId,
  submissionFeatureId,
  featureRouteBasePath,
  sectionId
}: FeaturePropertiesSectionProps) => {
  const api = useApi();

  const columns: GridColDef<IFeaturePropertyRow>[] = [
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
      renderCell: (params) => {
        const value = params.row.value;
        const title = typeof value === 'string' ? value : value.label;

        return (
          <Typography variant="body2" noWrap title={title} sx={{ width: '100%' }}>
            <PropertyValueDisplay value={value} featureRouteBasePath={featureRouteBasePath} />
          </Typography>
        );
      }
    }
  ];

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
      id={sectionId}
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
