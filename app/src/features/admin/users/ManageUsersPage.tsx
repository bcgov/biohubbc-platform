import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import Box from '@mui/material/Box';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { AddSystemUserI18N, BlockSystemUserI18N, UpdateSystemUserI18N } from 'constants/i18n';
import { SYSTEM_ROLE } from 'constants/roles';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ISystemUser } from 'interfaces/useUserApi.interface';
import groupBy from 'lodash-es/groupBy';
import { useCallback, useMemo, useState } from 'react';
import { userQueryKeys } from 'utils/query-keys/user-query-keys';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import ActiveUsersList from './ActiveUsersList';
import AddSystemUsersForm, {
  AddSystemUsersFormInitialValues,
  AddSystemUsersFormYupSchema,
  IAddSystemUsersForm
} from './AddSystemUsersForm';
import { ContributorPanel } from './contributors/content/ContributorPanel';

/**
 * Page to display user management data/functionality.
 *
 * @return {*}
 */
const ManageUsersPage: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  const authState = useAuthStateContext();
  const isSystemAdmin = authState.biohubUserWrapper.roleNames?.includes(SYSTEM_ROLE.SYSTEM_ADMIN) ?? false;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = isSystemAdmin && requestedTab === 'contributors' ? requestedTab : 'users';
  const [openAddUserDialog, setOpenAddUserDialog] = useState(false);

  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: userQueryKeys.roles(),
    queryFn: ({ signal }) => biohubApi.user.getRoles({ signal })
  });

  const usersGrid = useServerPaginatedGridState({ defaultSort: { field: 'user_identifier', sort: 'asc' } });
  const usersParams = { search: usersGrid.debouncedSearchTerm, ...usersGrid.apiPagination };
  const usersQuery = useQuery({
    queryKey: userQueryKeys.list(usersParams),
    queryFn: ({ signal }) => biohubApi.user.getUsersList(usersParams, { signal }),
    placeholderData: keepPreviousData
  });

  const systemRoles = rolesQuery.data ?? [];

  /**
   * Reloads every page of the users table after a user changes, and the user pickers that search the same users.
   *
   * @returns {void}
   */
  const refreshUsers = useCallback(
    () => refreshChangedQueries(queryClient, changedQueryKeys.systemUser()),
    [queryClient]
  );

  const handleCloseYesNoDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  const handleShowApiErrorDialog = useCallback(
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
      refreshUsers();

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Typography variant="body2" component="div">
            User <strong>{user.user_identifier}</strong> {recordEndDate ? 'blocked' : 'activated'}.
          </Typography>
        )
      });
    },
    [biohubApi.user, dialogContext, refreshUsers]
  );

  const handleBlockUser = useCallback(
    (user: ISystemUser) => {
      const handleConfirmBlock = async () => {
        try {
          await handleUpdateUserRecordEndDate(user, new Date().toISOString());
        } catch (caughtError) {
          handleShowApiErrorDialog(
            caughtError,
            BlockSystemUserI18N.blockUserErrorTitle,
            BlockSystemUserI18N.blockUserErrorText
          );
        } finally {
          handleCloseYesNoDialog();
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
        onClose: handleCloseYesNoDialog,
        onNo: handleCloseYesNoDialog,
        open: true,
        onYes: handleConfirmBlock
      });
    },
    [handleCloseYesNoDialog, dialogContext, handleUpdateUserRecordEndDate, handleShowApiErrorDialog]
  );

  const handleActivateUser = useCallback(
    (user: ISystemUser) => {
      const handleConfirmActivate = async () => {
        try {
          await handleUpdateUserRecordEndDate(user, null);
        } catch (caughtError) {
          handleShowApiErrorDialog(
            caughtError,
            UpdateSystemUserI18N.updateUserErrorTitle,
            UpdateSystemUserI18N.updateUserErrorText
          );
        } finally {
          handleCloseYesNoDialog();
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
        onClose: handleCloseYesNoDialog,
        onNo: handleCloseYesNoDialog,
        open: true,
        onYes: handleConfirmActivate
      });
    },
    [handleCloseYesNoDialog, dialogContext, handleUpdateUserRecordEndDate, handleShowApiErrorDialog]
  );

  const handleChangeUserPermissions = useCallback(
    (user: ISystemUser, roleId: number, roleName: string) => {
      const handleConfirmRoleChange = async () => {
        try {
          await biohubApi.user.updateSystemUserRoles(user.system_user_id, [roleId]);
          refreshUsers();

          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: (
              <Typography variant="body2" component="div">
                User <strong>{user.user_identifier}</strong>'s role has changed to <strong>{roleName}</strong>.
              </Typography>
            )
          });
        } catch (caughtError) {
          handleShowApiErrorDialog(
            caughtError,
            UpdateSystemUserI18N.updateUserErrorTitle,
            UpdateSystemUserI18N.updateUserErrorText
          );
        } finally {
          handleCloseYesNoDialog();
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
        onClose: handleCloseYesNoDialog,
        onNo: handleCloseYesNoDialog,
        open: true,
        onYes: handleConfirmRoleChange
      });
    },
    [biohubApi.user, handleCloseYesNoDialog, dialogContext, handleShowApiErrorDialog, refreshUsers]
  );

  const handleAddSystemUsersSave = useCallback(
    async (values: IAddSystemUsersForm) => {
      setOpenAddUserDialog(false);

      // Different users are added together. Rows naming the same user are sent one after another, since the server
      // reads or creates the user and two concurrent requests for one user would race that read. The server finds a
      // user by GUID alone, ignoring case, so rows are grouped the same way.
      const rowsByUser = groupBy(values.systemUsers, (systemUser) => systemUser.userGuid.toLowerCase());
      const addedUserCount = Object.keys(rowsByUser).length;
      const results = await Promise.allSettled(
        Object.values(rowsByUser).map((rows) =>
          rows.reduce<Promise<unknown>>(
            (previous, systemUser) =>
              previous.then(() =>
                biohubApi.admin.addSystemUser(
                  systemUser.userIdentifier,
                  systemUser.userGuid,
                  systemUser.identitySource,
                  systemUser.systemRole
                )
              ),
            Promise.resolve()
          )
        )
      );

      // Users added before a failure are listed whether or not every request succeeded.
      refreshUsers();

      const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failure) {
        handleShowApiErrorDialog(
          failure.reason,
          AddSystemUserI18N.addUserErrorTitle,
          AddSystemUserI18N.addUserErrorText
        );
        return;
      }

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Typography variant="body2" component="div">
            {addedUserCount} system {addedUserCount > 1 ? 'users' : 'user'} added.
          </Typography>
        )
      });
    },
    [biohubApi.admin, dialogContext, handleShowApiErrorDialog, refreshUsers]
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
      <PageHeader
        label="Administrative"
        breadcrumbs={
          <Breadcrumbs aria-label="users breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              Users
            </Typography>
          </Breadcrumbs>
        }
        tabs={
          <TabGroup
            value={activeTab}
            onChange={(value) => {
              setSearchParams(value === 'users' ? {} : { tab: value });
              if (value === 'users') {
                usersGrid.handlePaginationChange({ ...usersGrid.paginationModel, page: 0 });
              }
            }}
            ariaLabel="administrative tabs"
            tabs={[
              {
                value: 'users',
                label: 'Users',
                id: 'administrative-users-tab',
                ariaControls: 'administrative-users-tabpanel'
              },
              ...(isSystemAdmin
                ? [
                    {
                      value: 'contributors',
                      label: 'Contributors',
                      id: 'administrative-contributors-tab',
                      ariaControls: 'administrative-contributors-tabpanel'
                    }
                  ]
                : [])
            ]}
          />
        }
      />

      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        <QueryErrorDialog error={usersQuery.error} label="users" />
        <QueryErrorDialog error={rolesQuery.error} label="user roles" />
        <Box
          hidden={activeTab !== 'users'}
          role="tabpanel"
          id="administrative-users-tabpanel"
          aria-labelledby="administrative-users-tab">
          <ActiveUsersList
            rows={usersQuery.data?.users ?? []}
            rowCount={usersQuery.data?.pagination.total ?? 0}
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
        </Box>
        {activeTab === 'contributors' && (
          <Box
            role="tabpanel"
            id="administrative-contributors-tabpanel"
            aria-labelledby="administrative-contributors-tab">
            <ContributorPanel />
          </Box>
        )}
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
