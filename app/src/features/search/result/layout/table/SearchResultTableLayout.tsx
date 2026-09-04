import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Typography } from '@mui/material';
import { GridCellParams, GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PropertyValueDisplay } from 'components/property/PropertyValueDisplay';
import { FeatureTypeProperty } from 'interfaces/useCodesApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useMemo } from 'react';
import { formatSubmissionPropertyValue } from 'utils/search-result-utils';

interface SearchResultTableLayoutProps {
  /** Result rows rendered in the data grid. */
  results: SearchFeatureResultWithRelevancy[];
  /** Feature type properties rendered as one column each. */
  featureTypeProperties: FeatureTypeProperty[];
  /** Opens the selected result's feature detail page. */
  onClick?: (result: SearchFeatureResultWithRelevancy) => void;
}

/**
 * Renders search results in the table view.
 *
 * Table-view layout for result rows. Builds grid columns from the result schema
 * and forwards row clicks to `SearchResultOptions`. Property cells render via
 * `PropertyValueDisplay`, so reference values (taxon) show their label as a link while the
 * column's text value (tooltip) stays the formatted label.
 *
 * @param {SearchResultTableLayoutProps} props - Results, feature type properties, and optional row click callback.
 * @returns {JSX.Element} Search result data grid.
 */
export const SearchResultTableLayout = ({ results, featureTypeProperties, onClick }: SearchResultTableLayoutProps) => {
  const columns = useMemo<GridColDef<SearchFeatureResultWithRelevancy>[]>(() => {
    const propertyColumns: GridColDef<SearchFeatureResultWithRelevancy>[] = featureTypeProperties.map((property) => ({
      field: String(property.feature_type_property_id),
      headerName: property.display_name,
      minWidth: 160,
      flex: 1,
      sortable: false,
      valueGetter: (_value, row) => formatSubmissionPropertyValue(row.properties?.[property.name]),
      renderCell: (params) => (
        <Typography
          variant="body2"
          noWrap
          title={typeof params.value === 'string' ? params.value : ''}
          sx={{ width: '100%' }}>
          <PropertyValueDisplay
            value={params.row.properties?.[property.name]}
            submissionId={params.row.submission_id}
            featureRouteBasePath="/submission"
          />
        </Typography>
      )
    }));

    return [
      {
        field: 'is_secured',
        headerName: '',
        width: 30,
        minWidth: 30,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        cellClassName: 'secured-column-cell',
        headerClassName: 'secured-column-header',
        renderCell: (params: GridCellParams) => {
          if (!params.value) {
            return null;
          }
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', color: 'error.main', flexShrink: 0 }}>
              <Icon path={mdiLock} size={0.75} />
            </Box>
          );
        }
      },
      ...propertyColumns
    ];
  }, [featureTypeProperties]);

  return (
    <CustomDataGrid
      rows={results}
      columns={columns}
      getRowId={(row) => row.uuid}
      onRowClick={(params) => {
        onClick?.(params.row as SearchFeatureResultWithRelevancy);
      }}
      disableRowSelectionOnClick
      disableColumnSelector
      disableColumnMenu
      hideFooter
      sortingOrder={['asc', 'desc']}
      sx={{
        minWidth: '100%',
        '& .MuiDataGrid-root': {
          border: 'none'
        },
        '& .secured-column-cell, & .secured-column-header': { pl: '30px', justifyContent: 'center' }
      }}
    />
  );
};
