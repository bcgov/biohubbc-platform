import { mdiDotsVertical, mdiMenuDown, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Toolbar,
  Typography,
} from '@mui/material';
import EditDialog from 'components/dialog/EditDialog';
import { CustomMenuButton, CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import AddSystemUsersForm, {
  AddSystemUsersFormInitialValues,
  AddSystemUsersFormYupSchema,
  IAddSystemUsersForm,
} from 'features/admin/users/AddSystemUsersForm';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { ISystemUser } from 'interfaces/useUserApi.interface';
import { useState } from 'react';

export interface IPolicyPageUserProps {
  activeUsers: ISystemUser[];
  refresh: () => void;
}

export const PolicyPageUser: React.FC<IPolicyPageUserProps> = ({ activeUsers, refresh }) => {
  const api = useApi();
  const dialog = useDialogContext();
  const rolesLoader = useDataLoader(() => api.user.getRoles());
  rolesLoader.load();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [openAddUserDialog, setOpenAddUserDialog] = useState(false);

  const showSnack = (msg: React.ReactNode) =>
    dialog.setSnackbar({ open: true, snackbarMessage: msg });

  const removeUser = async (user: ISystemUser) => {
    if (!user.system_user_id) {
      return;
    }
    try {
      await api.user.deleteSystemUser(user.system_user_id);
      showSnack(
        <Typography variant="body2">
          User <strong>{user.user_identifier}</strong> removed.
        </Typography>
      );
      refresh();
    } catch (e: any) {
      dialog.setErrorDialog({
        open: true,
        dialogTitle: 'Error removing user',
        dialogText: e.message,
      });
    }
  };

  const changeRole = async (user: ISystemUser, roleId: number, roleName: string) => {
    try {
      await api.user.updateSystemUserRoles(user.system_user_id!, [roleId]);
      showSnack(
        <Typography variant="body2">
          User <strong>{user.user_identifier}</strong> role changed to <strong>{roleName}</strong>.
        </Typography>
      );
      refresh();
    } catch (e: any) {
      dialog.setErrorDialog({
        open: true,
        dialogTitle: 'Error updating role',
        dialogText: e.message,
      });
    }
  };

  const addUsers = async (values: IAddSystemUsersForm) => {
    try {
      await Promise.all(
        values.systemUsers.map((u) =>
          api.admin.addSystemUser(u.userIdentifier, u.userGuid, u.identitySource, u.systemRole)
        )
      );
      refresh();
      showSnack(
        <Typography variant="body2">{values.systemUsers.length} user(s) added.</Typography>
      );
    } catch (e: any) {
      dialog.setErrorDialog({
        open: true,
        dialogTitle: 'Error adding users',
        dialogText: e.message,
      });
    }
  };

  return (
    <>
      <Toolbar sx={{ justifyContent: 'space-between', alignItems: 'center', mx: 2 }} disableGutters>
        <Typography variant="h4">
          Active Users &zwnj;
          <Typography component="span" color="textSecondary">
            ({activeUsers.length})
          </Typography>
        </Typography>
        <Button
          variant="contained"
          startIcon={<Icon path={mdiPlus} size={1} />}
          onClick={() => setOpenAddUserDialog(true)}
          sx={{ mt: -2, fontWeight: 700 }}
        >
          Add Users
        </Button>
      </Toolbar>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activeUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  No Active Users
                </TableCell>
              </TableRow>
            )}
            {activeUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((user) => (
              <TableRow key={user.system_user_id}>
                <TableCell>{user.user_identifier || 'No identifier'}</TableCell>
                <TableCell>
                  <CustomMenuButton
                    buttonLabel={user.role_names.join(', ') || 'No role'}
                    buttonTitle="Change Role"
                    buttonEndIcon={<Icon path={mdiMenuDown} size={1} />}
                    menuItems={
                      rolesLoader.data?.map((r) => ({
                        menuLabel: r.name,
                        menuOnClick: () => changeRole(user, r.system_role_id, r.name),
                      })) || []
                    }
                  />
                </TableCell>
                <TableCell align="center">
                  <CustomMenuIconButton
                    buttonTitle="Actions"
                    buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
                    menuItems={[
                      {
                        menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                        menuLabel: 'Remove user',
                        menuOnClick: () => removeUser(user),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {activeUsers.length > 0 && (
        <TablePagination
          component="div"
          count={activeUsers.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[50, 100, 200]}
        />
      )}

      <EditDialog
        isLoading={rolesLoader.isLoading}
        dialogTitle="Add Users"
        open={openAddUserDialog}
        onCancel={() => setOpenAddUserDialog(false)}
        onSave={async (v) => {
          await addUsers(v);
          setOpenAddUserDialog(false);
        }}
        component={{
          element: (
            <AddSystemUsersForm
              system_roles={(rolesLoader.data || []).map((r) => ({
                value: r.system_role_id,
                label: r.name,
              }))}
            />
          ),
          initialValues: AddSystemUsersFormInitialValues,
          validationSchema: AddSystemUsersFormYupSchema,
        }}
      />
    </>
  );
};
