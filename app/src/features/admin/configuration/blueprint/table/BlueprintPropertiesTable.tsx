import { mdiDotsVertical, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import SearchTextField from 'components/fields/SearchTextField';
import { ConfigurationTableSkeleton } from '../../skeleton/ConfigurationTableSkeleton';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import {
  IBlueprintFeatureTypeProperty,
  IBlueprintFeatureTypePropertiesResponse
} from 'interfaces/useBlueprintFeatureTypePropertiesApi.interface';

import { IUseServerPaginatedDataGridReturn } from 'hooks/useServerPaginatedDataGrid';

interface IBlueprintPropertiesTableProps {
  table: IUseServerPaginatedDataGridReturn<IBlueprintFeatureTypeProperty, IBlueprintFeatureTypePropertiesResponse>;
  onCreate?: () => void;
  onDelete: (assignment: IBlueprintFeatureTypeProperty) => void;
  onEdit: (assignment: IBlueprintFeatureTypeProperty) => void;
}

/**
 * Display blueprint property memberships with pagination and assignment actions.
 *
 * @param props Prepared table state and assignment handlers.
 * @returns Searchable assignment table.
 */
export const BlueprintPropertiesTable = ({ table, onCreate, onDelete, onEdit }: IBlueprintPropertiesTableProps) => {
  const columns: GridColDef<IBlueprintFeatureTypeProperty>[] = [
    { field: 'name', headerName: 'Name', minWidth: 160, flex: 1 },
    { field: 'display_name', headerName: 'Display name', minWidth: 180, flex: 1 },
    { field: 'description', headerName: 'Description', minWidth: 220, flex: 1 },
    { field: 'type_name', headerName: 'Property type', minWidth: 140 },
    { field: 'required_value', headerName: 'Required value', type: 'boolean', width: 140 },
    { field: 'allow_multiple', headerName: 'Allow multiple', type: 'boolean', width: 140 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: ({ row }) => (
        <CustomMenuIconButton
          buttonProps={{ size: 'small' }}
          buttonTitle={`Actions for ${row.name}`}
          buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
          menuItems={[
            {
              menuLabel: 'Edit',
              menuIcon: <Icon path={mdiPencilOutline} size={0.875} />,
              menuOnClick: () => onEdit(row)
            },
            {
              menuLabel: 'Delete',
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuOnClick: () => onDelete(row)
            }
          ]}
        />
      )
    }
  ];
  return (
    <PageSection
      addButtonSize="small"
      id="blueprint-properties"
      label="Properties"
      addLabel="Assign"
      onAdd={onCreate}
      headerContent={
        <SearchTextField
          placeholder="Search properties"
          size="small"
          value={table.searchTerm}
          onChange={(event) => table.handleSearch(event.target.value)}
        />
      }>
      {table.isLoading && !table.response ? (
        <ConfigurationTableSkeleton columns={columns} />
      ) : (
        <ServerPaginatedDataGrid
          dataTestId="blueprint-properties-table"
          rows={table.rows}
          columns={columns}
          getRowId={(row) => row.blueprint_feature_type_property_id}
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
