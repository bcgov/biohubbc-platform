import { Stack } from '@mui/material';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import {
  CreateDataRequestDialog,
  CreateDataRequestDialogValues
} from 'features/data-request/components/CreateDataRequestDialog';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { useMemo, useState } from 'react';
import { TicketSidebarItem } from './TicketSidebarItem';
import { TicketSidebarSection } from './TicketSidebarSection';

const EMPTY_DATA_REQUESTS: DataRequestResponse[] = [];

/**
 * Data request sidebar section and create dialog.
 *
 * @return {*}
 */
export const TicketSidebarDataRequests = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const ticket = ticketDataLoader.data;
  const { biohubUserWrapper } = useAuthStateContext();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dataRequests = ticket?.data_requests ?? EMPTY_DATA_REQUESTS;

  const orderedDataRequests = useMemo(
    () => [...dataRequests].sort((a, b) => (a.create_date ?? '').localeCompare(b.create_date ?? '')),
    [dataRequests]
  );

  const handleCreateDataRequest = async (values: CreateDataRequestDialogValues) => {
    const requestedBy = biohubUserWrapper.systemUserId;
    if (requestedBy === undefined) {
      return;
    }

    try {
      setIsSubmitting(true);
      const createdDataRequest = await api.dataRequest.createTicketDataRequest(ticketId, {
        requested_by: requestedBy,
        reason: values.reason,
        system_user_ids: values.system_user_ids
      });
      const latestTicket = ticketDataLoader.data;

      if (latestTicket) {
        ticketDataLoader.setData({
          ...latestTicket,
          data_requests: [...latestTicket.data_requests, createdDataRequest]
        });
      }

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
        initialReason={ticketDataLoader.data?.description ?? ''}
        onCancel={() => setIsCreateDialogOpen(false)}
        onSave={handleCreateDataRequest}
      />
    </>
  );
};
