import { mdiDotsVertical, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { ConfigurationStatusChip } from './ConfigurationStatusChip';
import { getConfigurationStatus } from '../utils/lifecycleStatus';
import SearchTextField from 'components/fields/SearchTextField';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { ConfigurationTableSkeleton } from '../skeleton/ConfigurationTableSkeleton';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { IFeatureType, IFeatureTypesResponse } from 'interfaces/useFeatureTypesApi.interface';

import { IUseServerPaginatedDataGridReturn } from 'hooks/useServerPaginatedDataGrid';

interface IFeatureTypesTableProps {
  table: IUseServerPaginatedDataGridReturn<IFeatureType, IFeatureTypesResponse>;
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
export const FeatureTypesTable = ({ table, busy, onCreate, onEdit, onRetire }: IFeatureTypesTableProps) => {
  const columns: GridColDef<IFeatureType>[] = [
    { field: 'name', headerName: 'Name', minWidth: 160, flex: 1, sortable: false },
    { field: 'display_name', headerName: 'Display name', minWidth: 160, flex: 1, sortable: false },
    { field: 'description', headerName: 'Description', minWidth: 220, flex: 1, sortable: false },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 140,
      flex: 0.8,
      sortable: false,
      valueGetter: (_value, row) => getConfigurationStatus(row),
      renderCell: ({ value }) => <ConfigurationStatusChip status={value} />
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: ({ row }) => (
        <CustomMenuIconButton
          buttonTitle={`Actions for ${row.name}`}
          buttonProps={{ disabled: busy, size: 'small' }}
          buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
          menuItems={[
            {
              menuLabel: 'Edit',
              menuIcon: <Icon path={mdiPencilOutline} size={0.875} />,
              menuOnClick: () => onEdit(row)
            },
            {
              menuLabel: 'Retire',
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuOnClick: () => onRetire(row)
            }
          ]}
        />
      )
    }
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
      {table.isLoading && !table.response ? (
        <ConfigurationTableSkeleton columns={columns} />
      ) : (
        <ServerPaginatedDataGrid
          dataTestId="feature-types-table"
          rows={table.rows}
          columns={columns}
          getRowId={(row) => row.feature_type_id}
          noRowsMessage="No feature types"
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
