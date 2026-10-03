import Chip from '@mui/material/Chip';
import SearchTextField from 'components/fields/SearchTextField';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { ConfigurationTableSkeleton } from '../skeleton/ConfigurationTableSkeleton';
import { PageSection } from 'components/section/PageSection';
import { getConfigurationDefinitionColumns } from './ConfigurationDefinitionActions';
import { IFeatureProperty } from 'interfaces/useFeaturePropertiesApi.interface';

import { IServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';

interface IFeaturePropertiesTableProps {
  table: IServerPaginatedGridState;
  rows: IFeatureProperty[];
  rowCount: number;
  isLoading: boolean;
  busy: boolean;
  onCreate: () => void;
  onEdit: (row: IFeatureProperty) => void;
  onRetire: (row: IFeatureProperty) => void;
}

/**
 * Display global definitions with server pagination and metadata actions.
 *
 * @param props Prepared table state and definition action handlers.
 * @returns Searchable definition table.
 */
export const FeaturePropertiesTable = ({
  table,
  rows,
  rowCount,
  isLoading,
  busy,
  onCreate,
  onEdit,
  onRetire
}: IFeaturePropertiesTableProps) => {
  const columns: GridColDef<IFeatureProperty>[] = [
    { field: 'name', headerName: 'Name', minWidth: 160, flex: 1, sortable: false },
    { field: 'display_name', headerName: 'Display name', minWidth: 160, flex: 1, sortable: false },
    { field: 'description', headerName: 'Description', minWidth: 220, flex: 1, sortable: false },
    {
      field: 'type_name',
      headerName: 'Property type',
      minWidth: 160,
      flex: 1,
      sortable: false,
      renderCell: ({ value }) => <Chip label={value} size="small" sx={{ color: 'inherit' }} />
    },
    { field: 'calculated_value', headerName: 'Calculated', minWidth: 160, flex: 1, sortable: false, type: 'boolean' },
    ...getConfigurationDefinitionColumns<IFeatureProperty>(busy, onEdit, onRetire)
  ];
  return (
    <PageSection
      addButtonSize="small"
      id="properties"
      label="Properties"
      addLabel="Create"
      onAdd={onCreate}
      headerContent={
        <SearchTextField
          size="small"
          placeholder="Search properties"
          value={table.searchTerm}
          onChange={(event) => table.handleSearch(event.target.value)}
        />
      }>
      {isLoading ? (
        <ConfigurationTableSkeleton columns={columns} />
      ) : (
        <ServerPaginatedDataGrid
          dataTestId="properties-table"
          rows={rows}
          columns={columns}
          getRowId={(row) => row.feature_property_id}
          noRowsMessage="No properties"
          rowCount={rowCount}
          paginationModel={table.paginationModel}
          setPaginationModel={table.handlePaginationChange}
          sortModel={table.sortModel}
          setSortModel={table.handleSortChange}
        />
      )}
    </PageSection>
  );
};
