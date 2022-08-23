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
import { IErrorDialogProps } from 'components/dialog/ErrorDialog';
import { CustomMenuButton, CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { DeleteSystemUserI18N } from 'constants/i18n';
import { DialogContext, ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IGetRoles } from 'interfaces/useAdminApi.interface';
import { IGetUserResponse } from 'interfaces/useUserApi.interface';
import { useContext, useState } from 'react';
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
  activeUsers: IGetUserResponse[];
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
  const dialogContext = useContext(DialogContext);

  const [openAddUserDialog, setOpenAddUserDialog] = useState(false);

  const defaultErrorDialogProps = {
    dialogTitle: DeleteSystemUserI18N.deleteErrorTitle,
    dialogText: DeleteSystemUserI18N.deleteErrorText,
    open: false,
    onClose: () => {
      dialogContext.setErrorDialog({ open: false });
    },
    onOk: () => {
      dialogContext.setErrorDialog({ open: false });
    }
  };

  const showErrorDialog = (textDialogProps?: Partial<IErrorDialogProps>) => {
    dialogContext.setErrorDialog({ ...defaultErrorDialogProps, ...textDialogProps, open: true });
  };

  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  const handleRemoveUserClick = (row: IGetUserResponse) => {
    dialogContext.setYesNoDialog({
      dialogTitle: 'Remove user?',
      dialogContent: (
        <Typography variant="body1" component="div" color="textSecondary">
          Removing user <strong>{row.user_identifier}</strong> will revoke their access to this application. Are you
          sure you want to proceed?
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
      onYes: () => {
        deActivateSystemUser(row);
        dialogContext.setYesNoDialog({ open: false });
      }
    });
  };

  const deActivateSystemUser = async (user: IGetUserResponse) => {
    if (!user?.id) {
      return;
    }
    try {
      await biohubApi.user.deleteSystemUser(user.id);

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
      showErrorDialog({ dialogText: apiError.message, dialogErrorDetails: apiError.errors, open: true });
    }
  };

  const handleChangeUserPermissionsClick = (row: IGetUserResponse, newRoleName: any, newRoleId: number) => {
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
      onYes: () => {
        changeSystemUserRole(row, newRoleId, newRoleName);
        dialogContext.setYesNoDialog({ open: false });
      }
    });
  };

  const changeSystemUserRole = async (user: IGetUserResponse, roleId: number, roleName: string) => {
    if (!user?.id) {
      return;
    }
    const roleIds = [roleId];

    try {
      await biohubApi.user.updateSystemUserRoles(user.id, roleIds);

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
      showErrorDialog({ dialogText: apiError.message, dialogErrorDetails: apiError.errors, open: true });
    }
  };

  const handleAddSystemUsersSave = async (values: IAddSystemUsersForm) => {
    setOpenAddUserDialog(false);

    try {
      for (const systemUser of values.systemUsers) {
        await biohubApi.admin.addSystemUser(
          systemUser.userIdentifier,
          systemUser.identitySource,
          systemUser.system_role
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
      dialogContext.setErrorDialog({
        ...defaultErrorDialogProps,
        open: true,
        dialogError: (error as APIError).message,
        dialogErrorDetails: (error as APIError).errors
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
                    <TableRow data-testid={`active-user-row-${index}`} key={row.id}>
                      <TableCell>{row.user_identifier || 'No assigned role'}</TableCell>
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
                              //TODO: disabled view details button, page and router does not exist
                              // {
                              //   menuIcon: <Icon path={mdiInformationOutline} size={0.875} />,
                              //   menuLabel: 'View Users Details',
                              //   menuOnClick: () =>
                              //     history.push({
                              //       pathname: `/admin/users/${row.id}`,
                              //       state: row
                              //     })
                              // },
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
        onSave={(values) => {
          handleAddSystemUsersSave(values);
          setOpenAddUserDialog(false);
        }}
      />
    </>
  );
};

export default ActiveUsersList;
