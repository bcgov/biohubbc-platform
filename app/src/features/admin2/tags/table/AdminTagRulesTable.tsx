import {
  mdiDotsVertical,
  mdiPencil,
  mdiToggleSwitchOffOutline,
  mdiToggleSwitchOutline,
  mdiTrashCanOutline
} from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ITagRule } from 'interfaces/useTagRulesApi.interface';
import { useMemo } from 'react';
import { IServerPaginationProps } from 'types/pagination';
import { getRelativeTimeLabel } from 'utils/date';

interface IAdminTagRulesTableProps extends IServerPaginationProps {
  /** The current page of the tag's rules. */
  tagRules: ITagRule[];
  onEditTagRule: (tagRule: ITagRule) => void;
  /** Enables a disabled rule or disables an enabled one. */
  onToggleTagRuleEnabled: (tagRule: ITagRule) => void;
  onDeleteTagRule: (tagRule: ITagRule) => void;
}

/**
 * Server-paginated table of a tag's rules: each rule's name, description, whether it is enabled and created date,
 * sortable by name, state and created date, with edit, enable or disable, and delete actions.
 *
 * @param {IAdminTagRulesTableProps} props The page of rules, the grid's pagination and sort, and the row actions.
 * @returns {JSX.Element} The tag rules table.
 */
export const AdminTagRulesTable = (props: IAdminTagRulesTableProps) => {
  const {
    tagRules,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    onEditTagRule,
    onToggleTagRuleEnabled,
    onDeleteTagRule
  } = props;

  const columns: GridColDef<ITagRule>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        minWidth: 200,
        flex: 1,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.name}>
            {params.row.name}
          </Typography>
        )
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
        field: 'is_enabled',
        headerName: 'Status',
        minWidth: 120,
        flex: 0.5,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.row.is_enabled ? 'Enabled' : 'Disabled'}
            color={params.row.is_enabled ? 'success' : 'default'}
          />
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
                  menuLabel: 'Edit rule',
                  menuOnClick: () => onEditTagRule(params.row)
                },
                {
                  menuIcon: (
                    <Icon
                      path={params.row.is_enabled ? mdiToggleSwitchOffOutline : mdiToggleSwitchOutline}
                      size={0.875}
                    />
                  ),
                  menuLabel: params.row.is_enabled ? 'Disable rule' : 'Enable rule',
                  menuOnClick: () => onToggleTagRuleEnabled(params.row)
                },
                {
                  menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                  menuLabel: 'Delete rule',
                  menuOnClick: () => onDeleteTagRule(params.row)
                }
              ]}
            />
          </Box>
        )
      }
    ],
    [onDeleteTagRule, onEditTagRule, onToggleTagRuleEnabled]
  );

  return (
    <ServerPaginatedDataGrid<ITagRule>
      dataTestId="tag-rules-table"
      rows={tagRules}
      columns={columns}
      getRowId={(row) => row.tag_rule_id}
      noRowsMessage="No rules"
      rowCount={rowCount}
      paginationModel={paginationModel}
      setPaginationModel={setPaginationModel}
      sortModel={sortModel}
      setSortModel={setSortModel}
    />
  );
};
