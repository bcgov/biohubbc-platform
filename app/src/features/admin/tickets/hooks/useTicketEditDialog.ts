import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketExtended, IUpdateTicketRequest } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { useOptimisticTicketHandlers } from './useOptimisticTicketHandlers';

interface IUseTicketEditDialogProps {
  ticket: ITicketExtended;
}

/**
 * Edit ticket dialog state and save behavior.
 *
 * @param {IUseTicketEditDialogProps} props Hook props.
 * @return {*}
 */
export const useTicketEditDialog = (props: IUseTicketEditDialogProps) => {
  const { ticket } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId } = useTicketContext();
  const { handleOptimisticTicketUpdate } = useOptimisticTicketHandlers({ ticket });

  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const openEditDialog = () => setIsEditDialogOpen(true);

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
  };

  const handleEditTicket = async (payload: IUpdateTicketRequest) => {
    try {
      setIsSavingTicket(true);

      const nextTicket = {
        ...ticket,
        subject: payload.subject ?? ticket.subject,
        description: payload.description === undefined ? ticket.description : payload.description,
        priority: payload.priority ?? ticket.priority,
        status: payload.status ?? ticket.status
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
