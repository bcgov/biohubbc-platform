import SearchTextField from 'components/fields/SearchTextField';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { ConfigurationTableSkeleton } from '../skeleton/ConfigurationTableSkeleton';
import { PageSection } from 'components/section/PageSection';
import { getConfigurationDefinitionColumns } from './ConfigurationDefinitionActions';
import { IFeatureType } from 'interfaces/useFeatureTypesApi.interface';

import { IServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';

interface IFeatureTypesTableProps {
  table: IServerPaginatedGridState;
  rows: IFeatureType[];
  rowCount: number;
  isLoading: boolean;
  busy: boolean;
  onCreate: () => void;
  onEdit: (row: IFeatureType) => void;
  onRetire: (row: IFeatureType) => void;
}

/**
 * Display global definitions with server pagination and metadata actions.
 *
 * @param props Prepared table state and definition action handlers.
 * @returns Searchable definition table.
 */
export const FeatureTypesTable = ({
  table,
  rows,
  rowCount,
  isLoading,
  busy,
  onCreate,
  onEdit,
  onRetire
}: IFeatureTypesTableProps) => {
  const columns: GridColDef<IFeatureType>[] = [
    { field: 'name', headerName: 'Name', minWidth: 160, flex: 1, sortable: false },
    { field: 'display_name', headerName: 'Display name', minWidth: 160, flex: 1, sortable: false },
    { field: 'description', headerName: 'Description', minWidth: 220, flex: 1, sortable: false },
    ...getConfigurationDefinitionColumns<IFeatureType>(busy, onEdit, onRetire)
  ];
  return (
    <PageSection
      addButtonSize="small"
      id="feature-types"
      label="Feature Types"
      addLabel="Create"
      onAdd={onCreate}
      headerContent={
        <SearchTextField
          size="small"
          placeholder="Search feature types"
          value={table.searchTerm}
          onChange={(event) => table.handleSearch(event.target.value)}
        />
      }>
      {isLoading ? (
        <ConfigurationTableSkeleton columns={columns} />
      ) : (
        <ServerPaginatedDataGrid
          dataTestId="feature-types-table"
          rows={rows}
          columns={columns}
          getRowId={(row) => row.feature_type_id}
          noRowsMessage="No feature types"
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
