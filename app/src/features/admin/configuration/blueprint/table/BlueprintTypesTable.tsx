import { mdiDotsVertical, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import SearchTextField from 'components/fields/SearchTextField';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import {
  IBlueprintFeatureType,
  IBlueprintFeatureTypesResponse
} from 'interfaces/useBlueprintFeatureTypesApi.interface';
import { ConfigurationTableSkeleton } from '../../skeleton/ConfigurationTableSkeleton';

import { IUseServerPaginatedDataGridReturn } from 'hooks/useServerPaginatedDataGrid';

interface IBlueprintTypesTableProps {
  table: IUseServerPaginatedDataGridReturn<IBlueprintFeatureType, IBlueprintFeatureTypesResponse>;
  onCreate?: () => void;
  onDelete: (assignment: IBlueprintFeatureType) => void;
}

/**
 * Display blueprint feature-type memberships with pagination and assignment actions.
 *
 * @param props Prepared table state and assignment handlers.
 * @returns Searchable assignment table.
 */
export const BlueprintTypesTable = ({ table, onCreate, onDelete }: IBlueprintTypesTableProps) => {
  const columns: GridColDef<IBlueprintFeatureType>[] = [
    { field: 'name', headerName: 'Name', minWidth: 160, flex: 1 },
    { field: 'display_name', headerName: 'Display name', minWidth: 180, flex: 1 },
    { field: 'description', headerName: 'Description', minWidth: 220, flex: 1 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: ({ row }) => (
        <Box onClick={(event) => event.stopPropagation()}>
          <CustomMenuIconButton
            buttonProps={{ size: 'small' }}
            buttonTitle={`Actions for ${row.name}`}
            buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
            menuItems={[
              {
                menuLabel: 'Delete',
                menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                menuOnClick: () => onDelete(row)
              }
            ]}
          />
        </Box>
      )
    }
  ];
  return (
    <PageSection
      addButtonSize="small"
      id="blueprint-types"
      label="Feature Types"
      addLabel="Assign"
      onAdd={onCreate}
      headerContent={
        <SearchTextField
          placeholder="Search feature types"
          size="small"
          value={table.searchTerm}
          onChange={(event) => table.handleSearch(event.target.value)}
        />
      }>
      {table.isLoading && !table.response ? (
        <ConfigurationTableSkeleton columns={columns} />
      ) : (
        <ServerPaginatedDataGrid
          dataTestId="blueprint-types-table"
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          rows={table.rows}
          columns={columns}
          getRowId={(row) => row.blueprint_feature_type_id}
          noRowsMessage="No assignments"
          rowCount={table.rowCount}
          paginationModel={table.paginationModel}
          setPaginationModel={table.handlePaginationChange}
          sortModel={table.sortModel}
          setSortModel={table.handleSortChange}
        />
      )}
    </PageSection>
  );
};
