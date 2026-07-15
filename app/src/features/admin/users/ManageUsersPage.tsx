import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { EditDialog } from 'components/dialog/EditDialog';
import { AddSystemUserI18N, BlockSystemUserI18N, UpdateSystemUserI18N } from 'constants/i18n';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { ISystemUser } from 'interfaces/useUserApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ActiveUsersList from './ActiveUsersList';
import AddSystemUsersForm, {
  AddSystemUsersFormInitialValues,
  AddSystemUsersFormYupSchema,
  IAddSystemUsersForm
} from './AddSystemUsersForm';

const DEFAULT_PAGE_SIZE = 10;

/**
 * Page to display user management data/functionality.
 *
 * @return {*}
 */
const ManageUsersPage: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  const [activeTab, setActiveTab] = useState<'users'>('users');
  const [openAddUserDialog, setOpenAddUserDialog] = useState(false);

  const rolesDataLoader = useDataLoader(() => biohubApi.user.getRoles());

  useEffect(() => {
    rolesDataLoader.load();
  }, [rolesDataLoader]);

  const usersGrid = useServerPaginatedDataGrid({
    fetcher: (search, pagination) => biohubApi.user.getUsersList({ search, ...pagination }),
    extractData: (response) => response.users,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'user_identifier', sort: 'asc' },
    defaultPageSize: DEFAULT_PAGE_SIZE
  });

  const systemRoles = rolesDataLoader.data || [];

  const closeYesNoDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  const showApiErrorDialog = useCallback(
    (caughtError: unknown, title: string, text: string) => {
      const apiError = caughtError as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: title,
        dialogText: text,
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        onOk: () => {
          dialogContext.setErrorDialog({ open: false });
        }
      });
    },
    [dialogContext]
  );

  const handleUpdateUserRecordEndDate = useCallback(
    async (user: ISystemUser, recordEndDate: string | null) => {
      await biohubApi.user.updateSystemUser(user.system_user_id, { record_end_date: recordEndDate });
      usersGrid.refresh();

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Typography variant="body2" component="div">
            User <strong>{user.user_identifier}</strong> {recordEndDate ? 'blocked' : 'activated'}.
          </Typography>
        )
      });
    },
    [biohubApi.user, dialogContext, usersGrid]
  );

  const handleBlockUser = useCallback(
    (user: ISystemUser) => {
      const handleConfirmBlock = async () => {
        try {
          await handleUpdateUserRecordEndDate(user, new Date().toISOString());
        } catch (caughtError) {
          showApiErrorDialog(
            caughtError,
            BlockSystemUserI18N.blockUserErrorTitle,
            BlockSystemUserI18N.blockUserErrorText
          );
        } finally {
          closeYesNoDialog();
        }
      };

      dialogContext.setYesNoDialog({
        dialogTitle: 'Block user?',
        dialogContent: (
          <Typography variant="body1" component="div" color="textSecondary">
            Blocking user <strong>{user.user_identifier}</strong> will revoke their access to this application and all
            authorized endpoints. Are you sure you want to proceed?
          </Typography>
        ),
        yesButtonLabel: 'Block User',
        noButtonLabel: 'Cancel',
        yesButtonProps: { color: 'error' },
        onClose: closeYesNoDialog,
        onNo: closeYesNoDialog,
        open: true,
        onYes: handleConfirmBlock
      });
    },
    [closeYesNoDialog, dialogContext, handleUpdateUserRecordEndDate, showApiErrorDialog]
  );

  const handleActivateUser = useCallback(
    (user: ISystemUser) => {
      const handleConfirmActivate = async () => {
        try {
          await handleUpdateUserRecordEndDate(user, null);
        } catch (caughtError) {
          showApiErrorDialog(
            caughtError,
            UpdateSystemUserI18N.updateUserErrorTitle,
            UpdateSystemUserI18N.updateUserErrorText
          );
        } finally {
          closeYesNoDialog();
        }
      };

      dialogContext.setYesNoDialog({
        dialogTitle: 'Activate user?',
        dialogContent: (
          <Typography variant="body1" component="div" color="textSecondary">
            Activating user <strong>{user.user_identifier}</strong> will restore their access based on their assigned
            roles. Are you sure you want to proceed?
          </Typography>
        ),
        yesButtonLabel: 'Activate User',
        noButtonLabel: 'Cancel',
        yesButtonProps: { color: 'primary' },
        onClose: closeYesNoDialog,
        onNo: closeYesNoDialog,
        open: true,
        onYes: handleConfirmActivate
      });
    },
    [closeYesNoDialog, dialogContext, handleUpdateUserRecordEndDate, showApiErrorDialog]
  );

  const handleChangeUserPermissions = useCallback(
    (user: ISystemUser, roleId: number, roleName: string) => {
      const handleConfirmRoleChange = async () => {
        try {
          await biohubApi.user.updateSystemUserRoles(user.system_user_id, [roleId]);
          usersGrid.refresh();

          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: (
              <Typography variant="body2" component="div">
                User <strong>{user.user_identifier}</strong>'s role has changed to <strong>{roleName}</strong>.
              </Typography>
            )
          });
        } catch (caughtError) {
          showApiErrorDialog(
            caughtError,
            UpdateSystemUserI18N.updateUserErrorTitle,
            UpdateSystemUserI18N.updateUserErrorText
          );
        } finally {
          closeYesNoDialog();
        }
      };

      dialogContext.setYesNoDialog({
        dialogTitle: 'Change User Role?',
        dialogContent: (
          <Typography variant="body1" color="textSecondary">
            Change user <strong>{user.user_identifier}</strong>'s role to <strong>{roleName}</strong>?
          </Typography>
        ),
        yesButtonLabel: 'Change Role',
        noButtonLabel: 'Cancel',
        yesButtonProps: { color: 'primary' },
        onClose: closeYesNoDialog,
        onNo: closeYesNoDialog,
        open: true,
        onYes: handleConfirmRoleChange
      });
    },
    [biohubApi.user, closeYesNoDialog, dialogContext, showApiErrorDialog, usersGrid]
  );

  const handleAddSystemUsersSave = useCallback(
    async (values: IAddSystemUsersForm) => {
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

        usersGrid.refresh();

        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: (
            <Typography variant="body2" component="div">
              {values.systemUsers.length} system {values.systemUsers.length > 1 ? 'users' : 'user'} added.
            </Typography>
          )
        });
      } catch (caughtError) {
        showApiErrorDialog(caughtError, AddSystemUserI18N.addUserErrorTitle, AddSystemUserI18N.addUserErrorText);
      }
    },
    [biohubApi.admin, dialogContext, showApiErrorDialog, usersGrid]
  );

  const rowActions = useMemo(
    () => ({
      onChangeRole: handleChangeUserPermissions,
      onBlockUser: handleBlockUser,
      onActivateUser: handleActivateUser
    }),
    [handleActivateUser, handleBlockUser, handleChangeUserPermissions]
  );

  return (
    <>
      <Paper square elevation={0}>
        <Container maxWidth="xl" sx={{ py: 4, pb: 0 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h1" sx={{ ml: '-2px' }}>
              Administrative
            </Typography>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_, value) => {
              setActiveTab(value);
              usersGrid.handlePaginationChange({ ...usersGrid.paginationModel, page: 0 });
            }}
            aria-label="administrative tabs"
            sx={{ mt: 1.5 }}>
            <Tab
              value="users"
              label="Users"
              id="administrative-users-tab"
              aria-controls="administrative-users-tabpanel"
            />
          </Tabs>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        <ActiveUsersList
          rows={usersGrid.rows}
          rowCount={usersGrid.rowCount}
          paginationModel={usersGrid.paginationModel}
          setPaginationModel={usersGrid.handlePaginationChange}
          sortModel={usersGrid.sortModel}
          setSortModel={usersGrid.handleSortChange}
          searchTerm={usersGrid.searchTerm}
          onSearch={usersGrid.handleSearch}
          onAddUsers={() => setOpenAddUserDialog(true)}
          systemRoles={systemRoles}
          rowActions={rowActions}
        />
      </Container>

      <EditDialog
        isLoading={false}
        dialogTitle="Add Users"
        open={openAddUserDialog}
        dialogSaveButtonLabel="Add"
        component={{
          element: (
            <AddSystemUsersForm
              system_roles={systemRoles.map((role) => ({ value: role.system_role_id, label: role.name }))}
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

export default ManageUsersPage;
