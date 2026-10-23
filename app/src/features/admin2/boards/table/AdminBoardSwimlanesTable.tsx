import { mdiDotsVertical, mdiPencil, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { IBoardSwimlane } from 'interfaces/useBoardsApi.interface';
import { useMemo } from 'react';
import { IServerPaginationProps } from 'types/pagination';

interface IAdminBoardSwimlanesTableProps extends IServerPaginationProps {
  /** The current page of the board's swimlanes, in display order. */
  swimlanes: IBoardSwimlane[];
  onEditSwimlane: (swimlane: IBoardSwimlane) => void;
  onDeleteSwimlane: (swimlane: IBoardSwimlane) => void;
}

/**
 * Server-paginated table of a board's swimlanes in display order: each lane's name, sort order and description,
 * with edit and delete actions. Lanes keep their display order, so the columns are not sortable.
 *
 * @param {IAdminBoardSwimlanesTableProps} props The page of swimlanes, the grid's pagination and sort, and the row
 * actions.
 * @returns {JSX.Element} The swimlanes table.
 */
export const AdminBoardSwimlanesTable = (props: IAdminBoardSwimlanesTableProps) => {
  const {
    swimlanes,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    onEditSwimlane,
    onDeleteSwimlane
  } = props;

  const columns: GridColDef<IBoardSwimlane>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        minWidth: 200,
        flex: 1,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.name}>
            {params.row.name}
          </Typography>
        )
      },
      {
        field: 'sort_order',
        headerName: 'Sort order',
        minWidth: 120,
        flex: 0.5,
        sortable: false
      },
      {
        field: 'description',
        headerName: 'Description',
        minWidth: 240,
        flex: 1.5,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.description ?? ''} color="text.secondary">
            {params.row.description}
          </Typography>
        )
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 100,
        flex: 0.5,
        sortable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <CustomMenuIconButton
              buttonTitle="Actions"
              buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
              menuItems={[
                {
                  menuIcon: <Icon path={mdiPencil} size={0.875} />,
                  menuLabel: 'Edit swimlane',
                  menuOnClick: () => onEditSwimlane(params.row)
                },
                {
                  menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                  menuLabel: 'Delete swimlane',
                  menuOnClick: () => onDeleteSwimlane(params.row)
                }
              ]}
            />
          </Box>
        )
      }
    ],
    [onDeleteSwimlane, onEditSwimlane]
  );

  return (
    <ServerPaginatedDataGrid<IBoardSwimlane>
      dataTestId="board-swimlanes-table"
      rows={swimlanes}
      columns={columns}
      getRowId={(row) => row.board_swimlane_id}
      noRowsMessage="No swimlanes"
      rowCount={rowCount}
      paginationModel={paginationModel}
      setPaginationModel={setPaginationModel}
      sortModel={sortModel}
      setSortModel={setSortModel}
    />
  );
};
