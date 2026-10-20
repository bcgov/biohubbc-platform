import { mdiDotsVertical, mdiPencil, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { TagChip } from 'components/tags/TagChip';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ITag } from 'interfaces/useTagsApi.interface';
import { useMemo } from 'react';
import { IServerPaginationProps } from 'types/pagination';
import { getRelativeTimeLabel } from 'utils/date';

interface IAdminTagsTableProps extends IServerPaginationProps {
  /** The current page of tags. */
  tags: ITag[];
  /** Edits a tag; the actions column is shown only with edit and delete handlers. */
  onEditTag?: (tag: ITag) => void;
  /** Deletes a tag; the actions column is shown only with edit and delete handlers. */
  onDeleteTag?: (tag: ITag) => void;
  /** Opens a tag's page when its row is clicked. */
  onOpenTag?: (tag: ITag) => void;
}

/**
 * Server-paginated table of tags: each tag's chip, description and created date, sortable by name and created date,
 * with edit and delete actions and a row click that opens the tag when handlers are given.
 *
 * @param {IAdminTagsTableProps} props The page of tags, the grid's pagination and sort, and the optional row actions.
 * @returns {JSX.Element} The tags table.
 */
export const AdminTagsTable = (props: IAdminTagsTableProps) => {
  const {
    tags,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    onEditTag,
    onDeleteTag,
    onOpenTag
  } = props;

  const columns: GridColDef<ITag>[] = useMemo(() => {
    const tagColumns: GridColDef<ITag>[] = [
      {
        field: 'name',
        headerName: 'Tag',
        minWidth: 200,
        flex: 1,
        renderCell: (params) => <TagChip tag={params.row} />
      },
      {
        field: 'description',
        headerName: 'Description',
        minWidth: 280,
        flex: 2,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.description ?? ''} color="text.secondary">
            {params.row.description}
          </Typography>
        )
      },
      {
        field: 'create_date',
        headerName: 'Created',
        minWidth: 140,
        flex: 0.8,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.create_date}>
            {getRelativeTimeLabel(params.row.create_date)}
          </Typography>
        )
      }
    ];

    if (!onEditTag || !onDeleteTag) {
      return tagColumns;
    }

    return [
      ...tagColumns,
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
                  menuLabel: 'Edit tag',
                  menuOnClick: () => onEditTag(params.row)
                },
                {
                  menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                  menuLabel: 'Delete tag',
                  menuOnClick: () => onDeleteTag(params.row)
                }
              ]}
            />
          </Box>
        )
      }
    ];
  }, [onDeleteTag, onEditTag]);

  return (
    <ServerPaginatedDataGrid<ITag>
      dataTestId="tags-table"
      rows={tags}
      columns={columns}
      getRowId={(row) => row.tag_id}
      noRowsMessage="No tags"
      rowCount={rowCount}
      paginationModel={paginationModel}
      setPaginationModel={setPaginationModel}
      sortModel={sortModel}
      setSortModel={setSortModel}
      onRowClick={onOpenTag}
    />
  );
};
