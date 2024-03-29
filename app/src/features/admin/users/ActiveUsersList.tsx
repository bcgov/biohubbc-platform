import { mdiDotsVertical, mdiMenuDown, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import EditDialog from 'components/dialog/EditDialog';
import { CustomMenuButton, CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { AddSystemUserI18N, DeleteSystemUserI18N, UpdateSystemUserI18N } from 'constants/i18n';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { IGetRoles } from 'interfaces/useAdminApi.interface';
import { ISystemUser } from 'interfaces/useUserApi.interface';
import { useState } from 'react';
import { handleChangePage, handleChangeRowsPerPage } from 'utils/tablePaginationUtils';
import AddSystemUsersForm, {
  AddSystemUsersFormInitialValues,
  AddSystemUsersFormYupSchema,
  IAddSystemUsersForm
} from './AddSystemUsersForm';

const useStyles = makeStyles(() => ({
  table: {
    '& td': {
      verticalAlign: 'middle'
    }
  }
}));

export interface IActiveUsersListProps {
  activeUsers: ISystemUser[];
  refresh: () => void;
}

/**
 * Table to display a list of active users.
 *
 * @param {*} props
 * @return {*}
 */
const ActiveUsersList: React.FC<React.PropsWithChildren<IActiveUsersListProps>> = (props) => {
  const classes = useStyles();
  const biohubApi = useApi();
  const { activeUsers } = props;

  const rolesDataLoader = useDataLoader(() => {
    return biohubApi.user.getRoles();
  });

  rolesDataLoader.load();

  let systemRoles: IGetRoles[] = [];
  if (rolesDataLoader.data) {
    systemRoles = rolesDataLoader.data;
  }

  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [page, setPage] = useState(0);
  const dialogContext = useDialogContext();

  const [openAddUserDialog, setOpenAddUserDialog] = useState(false);

  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  const handleRemoveUserClick = (row: ISystemUser) => {
    dialogContext.setYesNoDialog({
      dialogTitle: 'Remove user?',
      dialogContent: (
        <Typography variant="body1" component="div" color="textSecondary">
          Removing user <strong>{row.user_identifier}</strong> will revoke their access to this application and all
          related projects. Are you sure you want to proceed?
        </Typography>
      ),
      yesButtonLabel: 'Remove User',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      open: true,
      onYes: async () => {
        await deActivateSystemUser(row);
        dialogContext.setYesNoDialog({ open: false });
      }
    });
  };

  const deActivateSystemUser = async (user: ISystemUser) => {
    if (!user?.system_user_id) {
      return;
    }
    try {
      await biohubApi.user.deleteSystemUser(user.system_user_id);

      showSnackBar({
        snackbarMessage: (
          <>
            <Typography variant="body2" component="div">
              User <strong>{user.user_identifier}</strong> removed from application.
            </Typography>
          </>
        ),
        open: true
      });

      props.refresh();
    } catch (error) {
      const apiError = error as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: DeleteSystemUserI18N.deleteUserErrorTitle,
        dialogText: DeleteSystemUserI18N.deleteUserErrorText,
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        onOk: () => {
          dialogContext.setErrorDialog({ open: false });
        }
      });
    }
  };

  const handleChangeUserPermissionsClick = (row: ISystemUser, newRoleName: any, newRoleId: number) => {
    dialogContext.setYesNoDialog({
      dialogTitle: 'Change User Role?',
      dialogContent: (
        <Typography variant="body1" color="textSecondary">
          Change user <strong>{row.user_identifier}</strong>'s role to <strong>{newRoleName}</strong>?
        </Typography>
      ),
      yesButtonLabel: 'Change Role',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'primary' },
      onClose: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      open: true,
      onYes: async () => {
        await changeSystemUserRole(row, newRoleId, newRoleName);
        dialogContext.setYesNoDialog({ open: false });
      }
    });
  };

  const changeSystemUserRole = async (user: ISystemUser, roleId: number, roleName: string) => {
    if (!user?.system_user_id) {
      return;
    }
    const roleIds = [roleId];

    try {
      await biohubApi.user.updateSystemUserRoles(user.system_user_id, roleIds);

      showSnackBar({
        snackbarMessage: (
          <>
            <Typography variant="body2" component="div">
              User <strong>{user.user_identifier}</strong>'s role has changed to <strong>{roleName}</strong>.
            </Typography>
          </>
        ),
        open: true
      });

      props.refresh();
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: UpdateSystemUserI18N.updateUserErrorTitle,
        dialogText: UpdateSystemUserI18N.updateUserErrorText,
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        onOk: () => {
          dialogContext.setErrorDialog({ open: false });
        }
      });
    }
  };

  const handleAddSystemUsersSave = async (values: IAddSystemUsersForm) => {
    setOpenAddUserDialog(false);

    try {
      for (const systemUser of values.systemUsers) {
        await biohubApi.admin.addSystemUser(
          systemUser.userIdentifier,
          systemUser.userGuid,
          systemUser.identitySource,
          systemUser.systemRole
        );
      }

      props.refresh();

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Typography variant="body2" component="div">
            {values.systemUsers.length} system {values.systemUsers.length > 1 ? 'users' : 'user'} added.
          </Typography>
        )
      });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: AddSystemUserI18N.addUserErrorTitle,
        dialogText: AddSystemUserI18N.addUserErrorText,
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        onOk: () => {
          dialogContext.setErrorDialog({ open: false });
        }
      });
    }
  };

  return (
    <>
      <Container maxWidth="xl">
        <Box mb={6} display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h1"
            sx={{
              mt: -2
            }}>
            Manage Users
          </Typography>
          <Button
            size="large"
            color="primary"
            variant="contained"
            data-testid="invite-system-users-button"
            aria-label={'Add Users'}
            startIcon={<Icon path={mdiPlus} size={1} />}
            onClick={() => setOpenAddUserDialog(true)}
            sx={{
              mt: -2,
              fontWeight: 700
            }}>
            Add Users
          </Button>
        </Box>
        <Paper>
          <Toolbar
            sx={{
              pl: { sm: 2 },
              pr: { xs: 1, sm: 1 }
            }}>
            <Typography variant="h4" component="h2">
              Active Users{' '}
              <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
                ({activeUsers?.length || 0})
              </Typography>
            </Typography>
          </Toolbar>
          <TableContainer>
            <Table className={classes.table}>
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell align="center" width="100">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody data-testid="active-users-table">
                {!activeUsers?.length && (
                  <TableRow data-testid={'active-users-row-0'}>
                    <TableCell colSpan={6} style={{ textAlign: 'center' }}>
                      No Active Users
                    </TableCell>
                  </TableRow>
                )}
                {activeUsers.length > 0 &&
                  activeUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                    <TableRow data-testid={`active-user-row-${index}`} key={row.system_user_id}>
                      <TableCell>{row.user_identifier || 'No identifier'}</TableCell>
                      <TableCell>
                        <CustomMenuButton
                          buttonLabel={row.role_names.join(', ') || 'No assigned role'}
                          buttonTitle={'Change User Permissions'}
                          menuItems={systemRoles.map((item) => {
                            return {
                              menuLabel: item.name,
                              menuOnClick: () => handleChangeUserPermissionsClick(row, item.name, item.system_role_id)
                            };
                          })}
                          buttonEndIcon={<Icon path={mdiMenuDown} size={1} />}
                        />
                      </TableCell>

                      <TableCell align="center">
                        <Box>
                          <CustomMenuIconButton
                            buttonTitle="Actions"
                            buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
                            menuItems={[
                              {
                                menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                                menuLabel: 'Remove user',
                                menuOnClick: () => handleRemoveUserClick(row)
                              }
                            ]}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          {activeUsers?.length > 0 && (
            <TablePagination
              rowsPerPageOptions={[50, 100, 200]}
              component="div"
              count={activeUsers.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(event: unknown, newPage: number) => handleChangePage(event, newPage, setPage)}
              onRowsPerPageChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handleChangeRowsPerPage(event, setPage, setRowsPerPage)
              }
            />
          )}
        </Paper>
      </Container>

      <EditDialog
        isLoading={false}
        dialogTitle={'Add Users'}
        open={openAddUserDialog}
        dialogSaveButtonLabel={'Add'}
        component={{
          element: (
            <AddSystemUsersForm
              system_roles={
                systemRoles.map((item) => {
                  return { value: item.system_role_id, label: item.name };
                }) || []
              }
            />
          ),
          initialValues: AddSystemUsersFormInitialValues,
          validationSchema: AddSystemUsersFormYupSchema
        }}
        onCancel={() => setOpenAddUserDialog(false)}
        onSave={async (values) => {
          await handleAddSystemUsersSave(values);
          setOpenAddUserDialog(false);
        }}
      />
    </>
  );
};

export default ActiveUsersList;
