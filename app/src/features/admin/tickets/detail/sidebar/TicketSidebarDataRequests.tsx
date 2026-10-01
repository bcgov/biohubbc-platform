import { reconcileAfterMutations } from 'hooks/useCoordinatedMutation';
import { Stack } from '@mui/material';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import {
  CreateDataRequestDialog,
  CreateDataRequestDialogValues
} from 'features/data-request/components/CreateDataRequestDialog';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { useTicketQuery } from '../../hooks/useTicketQuery';
import { TicketSidebarItem } from './TicketSidebarItem';
import { TicketSidebarSection } from './TicketSidebarSection';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

/**
 * Data request sidebar section and create dialog.
 *
 * @return {*}
 */
export const TicketSidebarDataRequests = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const queryClient = useQueryClient();
  const { ticketId, ticketQueryKey } = useTicketContext();
  const ticket = useTicketQuery().data;
  const { biohubUserWrapper } = useAuthStateContext();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const orderedDataRequests = useMemo(() => {
    const requests = ticket?.data_requests ?? [];
    return [...requests].sort((a, b) => (a.create_date ?? '').localeCompare(b.create_date ?? ''));
  }, [ticket?.data_requests]);

  /**
   * Creates a data request on the ticket, refreshes the ticket and closes the dialog; a failure keeps the
   * dialog open and shows the error.
   *
   * @param {CreateDataRequestDialogValues} values Reason and users to request data for.
   * @returns {Promise<void>} Resolves once the request has settled.
   */
  const handleCreateDataRequest = async (values: CreateDataRequestDialogValues) => {
    const requestedBy = biohubUserWrapper.systemUserId;
    if (requestedBy === undefined) {
      return;
    }

    try {
      setIsSubmitting(true);
      await api.dataRequest.createTicketDataRequest(ticketId, {
        requested_by: requestedBy,
        reason: values.reason,
        system_user_ids: values.system_user_ids
      });
      await queryClient.cancelQueries({ queryKey: ticketQueryKey, exact: true });
      await reconcileAfterMutations(queryClient, ticketQueryKey, ticketQueryKey);
      refreshChangedQueries(queryClient, changedQueryKeys.dataRequest(ticketId), ticketQueryKey);

      setIsCreateDialogOpen(false);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <TicketSidebarSection label="Data Requests" onAdd={() => setIsCreateDialogOpen(true)}>
        <LoadingGuard
          hasNoData={!orderedDataRequests.length}
          hasNoDataFallback={
            <Typography variant="body2" color="text.secondary">
              No data requests
            </Typography>
          }>
          <Stack spacing={0.75}>
            {orderedDataRequests.map((dataRequest) => (
              <TicketSidebarItem key={dataRequest.data_request_id} label={dataRequest.reason} />
            ))}
          </Stack>
        </LoadingGuard>
      </TicketSidebarSection>

      <CreateDataRequestDialog
        open={isCreateDialogOpen}
        isSubmitting={isSubmitting}
        initialReason={ticket?.description ?? ''}
        onCancel={() => setIsCreateDialogOpen(false)}
        onSave={handleCreateDataRequest}
      />
    </>
  );
};
