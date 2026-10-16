import { mdiDotsVertical, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { SYSTEM_ROLE } from 'constants/roles';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import { DataRequestRecipient } from 'interfaces/useDataRequestApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';

interface AdminDataRequestRecipientsProps {
  dataRequestId: string;
}

/**
 * Recipients tab of the administrative data request page: the users who receive access when the request is approved,
 * which are the members of the team the request's policy is assigned to. System administrators can remove a
 * recipient, which ends that user's membership of the team.
 *
 * @param {AdminDataRequestRecipientsProps} props The data request.
 * @returns {JSX.Element} Recipients table.
 */
export const AdminDataRequestRecipients = ({ dataRequestId }: AdminDataRequestRecipientsProps) => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();
  const authStateContext = useAuthStateContext();
  const canRemoveRecipients = authStateContext.biohubUserWrapper.roleNames?.includes(SYSTEM_ROLE.SYSTEM_ADMIN) ?? false;

  const recipientsQuery = useQuery({
    queryKey: policyQueryKeys.dataRequestRecipients(dataRequestId),
    queryFn: ({ signal }) => biohubApi.dataRequest.getDataRequestRecipients(dataRequestId, { signal })
  });
  const recipients = recipientsQuery.data?.recipients ?? [];

  const removeRecipientMutation = useMutation({
    mutationFn: (recipient: DataRequestRecipient) =>
      biohubApi.dataRequest.deleteDataRequestRecipient(dataRequestId, recipient.system_user_id),
    onSuccess: (_data, recipient) => {
      // A recipient is a team member, so the teams tables and membership-dependent reads change with this list.
      void refreshChangedQueries(queryClient, [
        policyQueryKeys.dataRequestRecipients(dataRequestId),
        ...changedQueryKeys.teamMembership()
      ]);
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Removed <strong>{recipient.display_name ?? recipient.user_identifier}</strong> from the request.
          </Typography>
        )
      });
    },
    onError: (error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });

  /**
   * Asks for confirmation, then removes the recipient from the request.
   *
   * @param {DataRequestRecipient} recipient The recipient to remove.
   * @returns {void}
   */
  const handleRemoveRecipientClick = (recipient: DataRequestRecipient) => {
    const closeDialog = () => dialogContext.setYesNoDialog({ open: false });

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Remove recipient?',
      dialogContent: (
        <Typography variant="body1" component="div" color="textSecondary">
          Removing <strong>{recipient.display_name ?? recipient.user_identifier}</strong> means they will no longer
          receive access through this request. Are you sure you want to proceed?
        </Typography>
      ),
      yesButtonLabel: 'Remove Recipient',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: closeDialog,
      onNo: closeDialog,
      onYes: () => {
        closeDialog();
        removeRecipientMutation.mutate(recipient);
      }
    });
  };

  const dataColumns: GridColDef<DataRequestRecipient>[] = [
    { field: 'display_name', headerName: 'Display Name', flex: 1 },
    { field: 'user_identifier', headerName: 'IDIR', flex: 1 },
    { field: 'email', headerName: 'Email', flex: 1 }
  ];
  const actionsColumn: GridColDef<DataRequestRecipient> = {
    field: 'actions',
    headerName: 'Actions',
    width: 100,
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
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuLabel: 'Remove recipient',
              menuOnClick: () => handleRemoveRecipientClick(params.row)
            }
          ]}
        />
      </Box>
    )
  };
  const columns = canRemoveRecipients ? [...dataColumns, actionsColumn] : dataColumns;

  return (
    <>
      <QueryErrorDialog error={recipientsQuery.error} label="recipients" />
      <PageSection
        id="data-request-recipients"
        label={
          <>
            Recipients{' '}
            {recipientsQuery.data && (
              <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
                ({recipients.length})
              </Typography>
            )}
          </>
        }>
        <CustomDataGrid
          data-testid="data-request-recipients-table"
          rows={recipients}
          columns={columns}
          getRowId={(row) => row.system_user_id}
          loading={recipientsQuery.isPending}
          noRowsMessage="No Recipients"
          disableRowSelectionOnClick
          disableColumnSelector
          hideFooter
          autoHeight
        />
      </PageSection>
    </>
  );
};
