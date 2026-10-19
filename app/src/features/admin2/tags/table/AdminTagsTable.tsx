import { mdiDotsVertical, mdiPencil, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { TagChip } from 'components/tags/TagChip';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ITag } from 'interfaces/useTagsApi.interface';
import { useMemo } from 'react';
import { getRelativeTimeLabel } from 'utils/date';

interface IAdminTagsTableProps {
  tags: ITag[];
  isLoading: boolean;
  onEditTag: (tag: ITag) => void;
  onDeleteTag: (tag: ITag) => void;
}

/**
 * Table of tags: each tag's chip, description and created date, with edit and delete actions.
 *
 * @param {IAdminTagsTableProps} props The tags and their row actions.
 * @returns {JSX.Element} The tags table.
 */
export const AdminTagsTable = (props: IAdminTagsTableProps) => {
  const { tags, isLoading, onEditTag, onDeleteTag } = props;

  const columns: GridColDef<ITag>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Tag',
        minWidth: 200,
        flex: 1,
        sortable: false,
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
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.create_date}>
            {getRelativeTimeLabel(params.row.create_date)}
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
    ],
    [onDeleteTag, onEditTag]
  );

  return (
    <CustomDataGrid<ITag>
      data-testid="tags-table"
      autoHeight
      rows={tags}
      columns={columns}
      getRowId={(row) => row.tag_id}
      loading={isLoading}
      noRowsMessage="No tags"
      rowSelection={false}
      pageSizeOptions={[25, 50, 100]}
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
    />
  );
};
