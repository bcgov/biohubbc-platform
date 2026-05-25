import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { IUpdateTicketRequest } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { TICKET_DATA_NOT_LOADED_MESSAGE, useOptimisticTicketHandlers } from './useOptimisticTicketHandlers';

/**
 * Edit ticket dialog state and save behavior.
 *
 * @return {*}
 */
export const useTicketEditDialog = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const { handleOptimisticTicketUpdate } = useOptimisticTicketHandlers();

  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const openEditDialog = () => setIsEditDialogOpen(true);

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
  };

  const handleEditTicket = async (payload: IUpdateTicketRequest) => {
    const currentTicket = ticketDataLoader.data;

    if (!currentTicket) {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: TICKET_DATA_NOT_LOADED_MESSAGE
      });
      return;
    }

    try {
      setIsSavingTicket(true);

      const nextTicket = {
        ...currentTicket,
        subject: payload.subject ?? currentTicket.subject,
        description: payload.description === undefined ? currentTicket.description : payload.description,
        priority: payload.priority ?? currentTicket.priority,
        status: payload.status ?? currentTicket.status
      };

      const updatePayload: IUpdateTicketRequest = {
        subject: nextTicket.subject,
        description: nextTicket.description,
        priority: nextTicket.priority
      };

      if (payload.status !== undefined) {
        updatePayload.status = nextTicket.status;
      }

      await handleOptimisticTicketUpdate({
        buildOptimisticTicket: () => nextTicket,
        handleUpdate: () => api.tickets.updateTicket(ticketId, updatePayload)
      });

      setIsEditDialogOpen(false);
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSavingTicket(false);
    }
  };

  return {
    isSavingTicket,
    isEditDialogOpen,
    openEditDialog,
    closeEditDialog,
    handleEditTicket
  };
};
