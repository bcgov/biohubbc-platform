import { mdiCancel, mdiCheck, mdiDotsVertical, mdiMagnify, mdiMenuDown } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuButton, CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { IGetRoles } from 'interfaces/useAdminApi.interface';
import { ISystemUser } from 'interfaces/useUserApi.interface';
import { useMemo } from 'react';
import { IServerPaginationProps } from 'types/pagination';

export interface IUsersListRowActions {
  onChangeRole: (user: ISystemUser, roleId: number, roleName: string) => void;
  onBlockUser: (user: ISystemUser) => void;
  onActivateUser: (user: ISystemUser) => void;
}

export interface IActiveUsersListProps extends IServerPaginationProps {
  rows: ISystemUser[];
  systemRoles: IGetRoles[];
  searchTerm: string;
  onSearch: (term: string) => void;
  onAddUsers: () => void;
  rowActions: IUsersListRowActions;
}

/**
 * Server-paginated system users list.
 *
 * @param {IActiveUsersListProps} props
 * @return {*}
 */
const ActiveUsersList: React.FC<IActiveUsersListProps> = (props) => {
  const {
    rows,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    systemRoles,
    searchTerm,
    onSearch,
    onAddUsers,
    rowActions
  } = props;

  const columns: GridColDef<ISystemUser>[] = useMemo(
    () => [
      {
        field: 'user_identifier',
        headerName: 'Username',
        minWidth: 220,
        flex: 1,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {params.value || 'No identifier'}
          </Typography>
        )
      },
      {
        field: 'identity_source',
        headerName: 'Identity Source',
        minWidth: 150,
        flex: 0.8,
        renderCell: (params) => <Typography variant="body2">{params.value}</Typography>
      },
      {
        field: 'record_end_date',
        headerName: 'Status',
        minWidth: 130,
        flex: 0.6,
        renderCell: (params) => {
          const isBlocked = Boolean(params.value);

          return (
            <Chip
              label={isBlocked ? 'Blocked' : 'Active'}
              size="small"
              color={isBlocked ? 'default' : 'success'}
              sx={{ fontWeight: 700 }}
            />
          );
        }
      },
      {
        field: 'role_names',
        headerName: 'Role',
        minWidth: 220,
        flex: 1,
        sortable: false,
        renderCell: (params) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <CustomMenuButton
              buttonLabel={params.row.role_names.join(', ') || 'No assigned role'}
              buttonTitle="Change User Permissions"
              menuItems={systemRoles.map((role) => ({
                menuLabel: role.name,
                menuOnClick: () => rowActions.onChangeRole(params.row, role.system_role_id, role.name)
              }))}
              buttonEndIcon={<Icon path={mdiMenuDown} size={1} />}
            />
          </Box>
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
        renderCell: (params) => {
          const isBlocked = Boolean(params.row.record_end_date);

          return (
            <Box onClick={(event) => event.stopPropagation()}>
              <CustomMenuIconButton
                buttonTitle="Actions"
                buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
                menuItems={[
                  isBlocked
                    ? {
                        menuIcon: <Icon path={mdiCheck} size={0.875} />,
                        menuLabel: 'Activate user',
                        menuOnClick: () => rowActions.onActivateUser(params.row)
                      }
                    : {
                        menuIcon: <Icon path={mdiCancel} size={0.875} />,
                        menuLabel: 'Block user',
                        menuOnClick: () => rowActions.onBlockUser(params.row)
                      }
                ]}
              />
            </Box>
          );
        }
      }
    ],
    [rowActions, systemRoles]
  );

  return (
    <PageSection
      id="users"
      label={
        <>
          Users{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </>
      }
      onAdd={onAddUsers}
      addLabel="Add Users"
      headerContent={
        <Stack gap={1} direction="row" alignItems="center">
          <TextField
            size="small"
            placeholder="Search by username"
            value={searchTerm}
            onChange={(event) => onSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon path={mdiMagnify} size={0.875} />
                  </InputAdornment>
                )
              }
            }}
            sx={{ width: 250 }}
          />
        </Stack>
      }>
      <ServerPaginatedDataGrid<ISystemUser>
        dataTestId="users-table"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.system_user_id}
        noRowsMessage="No users"
        rowCount={rowCount}
        paginationModel={paginationModel}
        setPaginationModel={setPaginationModel}
        sortModel={sortModel}
        setSortModel={setSortModel}
      />
    </PageSection>
  );
};

export default ActiveUsersList;
