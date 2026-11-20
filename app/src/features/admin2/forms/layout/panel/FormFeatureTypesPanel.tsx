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
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { IFeatureType } from 'interfaces/useFeatureTypesApi.interface';
import { useState } from 'react';

const columns: GridColDef<IFeatureType>[] = [
  { field: 'display_name', headerName: 'Feature', flex: 1, sortable: false }
];

const EMPTY_SELECTION: GridRowSelectionModel = { type: 'include', ids: new Set() };

interface IFormFeatureTypesPanelProps {
  /** Feature types already in the form, which cannot be selected again. */
  addedFeatureTypeIds: number[];
  /** Appends the selected feature types to the form as sections. */
  onAdd: (featureTypes: IFeatureType[]) => void;
  /** Hides the add action for a published form. */
  readOnly: boolean;
}

/**
 * Left sidebar of the form builder: a server-paginated list of the feature types in the system. Selecting one or more
 * and choosing "Add to Form" appends them to the form as sections. Retired feature types are not listed.
 *
 * @param {IFormFeatureTypesPanelProps} props
 * @returns {JSX.Element} Feature type picker.
 */
export const FormFeatureTypesPanel = ({ addedFeatureTypeIds, onAdd, readOnly }: IFormFeatureTypesPanelProps) => {
  const biohubApi = useApi();
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>(EMPTY_SELECTION);

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const featureTypesQuery = useQuery({
    queryKey: ['forms', 'featureTypes', grid.debouncedSearchTerm, grid.apiPagination],
    queryFn: () => biohubApi.featureTypes.getFeatureTypes({ search: grid.debouncedSearchTerm }, grid.apiPagination),
    placeholderData: keepPreviousData
  });
  const rows = (featureTypesQuery.data?.feature_types ?? []).filter((featureType) => !featureType.record_end_date);
  // A "select all" selection is expressed as the ids excluded from it.
  const selectedFeatureTypes = rows.filter(
    (featureType) =>
      selectionModel.ids.has(featureType.feature_type_id) === (selectionModel.type === 'include') &&
      !addedFeatureTypeIds.includes(featureType.feature_type_id)
  );

  return (
    <>
      <QueryErrorDialog error={featureTypesQuery.error} label="feature types" />
      <PageSection id="form-features" label="Features">
        <Box p={2}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search features"
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
        <ServerPaginatedDataGrid<IFeatureType>
          dataTestId="form-feature-types-table"
          rows={rows}
          columns={columns}
          getRowId={(row) => row.feature_type_id}
          noRowsMessage="No Features"
          rowCount={featureTypesQuery.data?.pagination.total ?? 0}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          checkboxSelection={!readOnly}
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={setSelectionModel}
        />
        {!readOnly && selectedFeatureTypes.length > 0 && (
          <>
            <Divider />
            <Box p={2} display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                startIcon={<Icon path={mdiPlus} size={0.8} />}
                onClick={() => {
                  onAdd(selectedFeatureTypes);
                  setSelectionModel(EMPTY_SELECTION);
                }}>
                Add to Form
              </Button>
            </Box>
          </>
        )}
      </PageSection>
    </>
  );
};
