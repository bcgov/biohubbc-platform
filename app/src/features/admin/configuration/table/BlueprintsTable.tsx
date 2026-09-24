import Box from '@mui/material/Box';
import { ConfigurationStatusChip } from './ConfigurationStatusChip';
import { IBlueprintTableRow } from './BlueprintsTable.interface';
import { mdiCheck, mdiDotsVertical, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import SearchTextField from 'components/fields/SearchTextField';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { ConfigurationTableSkeleton } from '../skeleton/ConfigurationTableSkeleton';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { IBlueprint, IBlueprintsResponse } from 'interfaces/useBlueprintsApi.interface';

import { IUseServerPaginatedDataGridReturn } from 'hooks/useServerPaginatedDataGrid';

interface IBlueprintsTableProps {
  table: IUseServerPaginatedDataGridReturn<IBlueprintTableRow, IBlueprintsResponse>;
  onOpenBlueprint: (blueprint: IBlueprint) => void;
  onCreateBlueprint: () => void;
  onEditBlueprint: (blueprint: IBlueprint) => void;
  onRetireBlueprint: (blueprint: IBlueprint) => void;
  onSetDefaultBlueprint: (blueprint: IBlueprint) => void;
}

/**
 * Display blueprint metadata and actions without owning mutations or dialogs.
 *
 * @param props Prepared table state and blueprint actions.
 * @returns Searchable blueprint catalogue.
 */
export const BlueprintsTable = ({
  table,
  onOpenBlueprint,
  onCreateBlueprint,
  onEditBlueprint,
  onRetireBlueprint,
  onSetDefaultBlueprint
}: IBlueprintsTableProps) => {
  const columns: GridColDef<IBlueprintTableRow>[] = [
    {
      field: 'name',
      headerName: 'Name',
      minWidth: 160,
      flex: 1,
      sortable: true
    },
    { field: 'version_number', headerName: 'Version', minWidth: 160, flex: 1, sortable: true },
    { field: 'description', headerName: 'Description', minWidth: 220, flex: 1, sortable: false },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 140,
      flex: 0.8,
      sortable: false,
      renderCell: ({ row }) => <ConfigurationStatusChip status={row.status} />
    },
    { field: 'is_default', headerName: 'Default', minWidth: 160, flex: 1, sortable: true, type: 'boolean' },
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
                menuLabel: 'Set as default',
                menuIcon: <Icon path={mdiCheck} size={0.875} />,
                menuOnClick: () => onSetDefaultBlueprint(row)
              },
              {
                menuLabel: 'Edit',
                menuIcon: <Icon path={mdiPencilOutline} size={0.875} />,
                menuOnClick: () => onEditBlueprint(row)
              },
              {
                menuLabel: 'Retire',
                menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                menuOnClick: () => onRetireBlueprint(row)
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
      id="blueprints"
      label="Blueprints"
      addLabel="Create"
      onAdd={onCreateBlueprint}
      headerContent={
        <SearchTextField
          size="small"
          placeholder="Search blueprints"
          value={table.searchTerm}
          onChange={(event) => table.handleSearch(event.target.value)}
        />
      }>
      {table.isLoading && !table.response ? (
        <ConfigurationTableSkeleton columns={columns} />
      ) : (
        <ServerPaginatedDataGrid
          dataTestId="blueprints-table"
          rows={table.rows}
          columns={columns}
          getRowId={(row) => row.blueprint_id}
          onRowClick={onOpenBlueprint}
          noRowsMessage="No blueprints"
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
