import { mdiDotsVertical, mdiPencil, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { TagChip } from 'components/tags/TagChip';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ITagRule } from 'interfaces/useTagRulesApi.interface';
import { useMemo } from 'react';

interface IAdminTagRulesTableProps {
  tagRules: ITagRule[];
  isLoading: boolean;
  onEditTagRule: (tagRule: ITagRule) => void;
  onDeleteTagRule: (tagRule: ITagRule) => void;
}

/**
 * Table of tag rules: each rule's name, the tag it applies and whether it is enabled, with edit and delete actions.
 *
 * @param {IAdminTagRulesTableProps} props The tag rules and their row actions.
 * @returns {JSX.Element} The tag rules table.
 */
export const AdminTagRulesTable = (props: IAdminTagRulesTableProps) => {
  const { tagRules, isLoading, onEditTagRule, onDeleteTagRule } = props;

  const columns: GridColDef<ITagRule>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        minWidth: 200,
        flex: 1,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.description ?? params.row.name} fontWeight={700}>
            {params.row.name}
          </Typography>
        )
      },
      {
        field: 'tag_name',
        headerName: 'Tag',
        minWidth: 160,
        flex: 0.8,
        sortable: false,
        renderCell: (params) => <TagChip tag={{ name: params.row.tag_name, color: params.row.tag_color }} />
      },
      {
        field: 'is_enabled',
        headerName: 'State',
        minWidth: 110,
        flex: 0.5,
        sortable: false,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.row.is_enabled ? 'Enabled' : 'Disabled'}
            color={params.row.is_enabled ? 'success' : 'default'}
          />
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
                  menuLabel: 'Edit tag rule',
                  menuOnClick: () => onEditTagRule(params.row)
                },
                {
                  menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                  menuLabel: 'Delete tag rule',
                  menuOnClick: () => onDeleteTagRule(params.row)
                }
              ]}
            />
          </Box>
        )
      }
    ],
    [onDeleteTagRule, onEditTagRule]
  );

  return (
    <CustomDataGrid<ITagRule>
      data-testid="tag-rules-table"
      autoHeight
      rows={tagRules}
      columns={columns}
      getRowId={(row) => row.tag_rule_id}
      loading={isLoading}
      noRowsMessage="No tag rules"
      rowSelection={false}
      pageSizeOptions={[25, 50, 100]}
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
    />
  );
};
