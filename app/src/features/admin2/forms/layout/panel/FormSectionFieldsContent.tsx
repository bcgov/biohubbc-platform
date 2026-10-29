import { mdiMagnify, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { FORM_SUPPORTED_PROPERTY_TYPES } from 'constants/form';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { IFeatureProperty } from 'interfaces/useFeaturePropertiesApi.interface';
import { useState } from 'react';

const columns: GridColDef<IFeatureProperty>[] = [
  { field: 'display_name', headerName: 'Property', flex: 1, sortable: false },
  { field: 'type_name', headerName: 'Type', width: 100, sortable: false }
];

const EMPTY_SELECTION: GridRowSelectionModel = { type: 'include', ids: new Set() };

interface IFormSectionFieldsContentProps {
  /** Properties already in the selected section, which cannot be selected again. */
  addedFeaturePropertyIds: number[];
  /** Appends the selected properties to the selected section as fields. */
  onAdd: (featureProperties: IFeatureProperty[]) => void;
  /** Hides the add action for a published form. */
  readOnly: boolean;
}

/**
 * Fields tab of the form builder's configuration panel: a server-paginated list of the properties in the system.
 * Selecting one or more and choosing "Add to Form" appends them to the selected section as fields. Retired properties,
 * and properties of types a form cannot collect, are not listed.
 *
 * @param {IFormSectionFieldsContentProps} props
 * @returns {JSX.Element} Property picker.
 */
export const FormSectionFieldsContent = ({
  addedFeaturePropertyIds,
  onAdd,
  readOnly
}: IFormSectionFieldsContentProps) => {
  const biohubApi = useApi();
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>(EMPTY_SELECTION);

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const featurePropertiesQuery = useQuery({
    queryKey: ['forms', 'featureProperties', grid.debouncedSearchTerm, grid.apiPagination],
    queryFn: () =>
      biohubApi.featureProperties.getFeatureProperties({ search: grid.debouncedSearchTerm }, grid.apiPagination),
    placeholderData: keepPreviousData
  });
  const rows = (featurePropertiesQuery.data?.feature_properties ?? []).filter(
    (featureProperty) =>
      !featureProperty.record_end_date && FORM_SUPPORTED_PROPERTY_TYPES.includes(featureProperty.type_name)
  );
  // A "select all" selection is expressed as the ids excluded from it.
  const selectedFeatureProperties = rows.filter(
    (featureProperty) =>
      selectionModel.ids.has(featureProperty.feature_property_id) === (selectionModel.type === 'include') &&
      !addedFeaturePropertyIds.includes(featureProperty.feature_property_id)
  );

  return (
    <>
      <QueryErrorDialog error={featurePropertiesQuery.error} label="properties" />
      <Box p={2}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search properties"
          value={grid.searchTerm}
          onChange={(event) => grid.handleSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Icon path={mdiMagnify} size={0.875} />
                </InputAdornment>
              )
            }
          }}
        />
      </Box>
      <ServerPaginatedDataGrid<IFeatureProperty>
        dataTestId="form-feature-properties-table"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.feature_property_id}
        noRowsMessage="No Properties"
        rowCount={featurePropertiesQuery.data?.pagination.total ?? 0}
        paginationModel={grid.paginationModel}
        setPaginationModel={grid.handlePaginationChange}
        sortModel={grid.sortModel}
        setSortModel={grid.handleSortChange}
        checkboxSelection={!readOnly}
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={setSelectionModel}
      />
      {!readOnly && selectedFeatureProperties.length > 0 && (
        <>
          <Divider />
          <Box p={2} display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={<Icon path={mdiPlus} size={0.8} />}
              onClick={() => {
                onAdd(selectedFeatureProperties);
                setSelectionModel(EMPTY_SELECTION);
              }}>
              Add to Form
            </Button>
          </Box>
        </>
      )}
    </>
  );
};
