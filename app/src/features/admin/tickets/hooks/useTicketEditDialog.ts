import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketWithHistory, IUpdateTicketRequest } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

interface IUseTicketEditDialogProps {
  ticket: ITicketWithHistory;
}

/**
 * Edit ticket dialog state and save behavior.
 *
 * @param {IUseTicketEditDialogProps} props
 * @return {*}
 */
export const useTicketEditDialog = (props: IUseTicketEditDialogProps) => {
  const { ticket } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId, ticketDataLoader } = useTicketContext();

  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const openEditDialog = () => setIsEditDialogOpen(true);

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
  };

  const handleEditTicket = async (payload: IUpdateTicketRequest) => {
    try {
      setIsSavingTicket(true);

      const nextTicket: ITicketWithHistory = {
        ...ticket,
        subject: payload.subject ?? ticket.subject,
        description: payload.description === undefined ? ticket.description : payload.description,
        priority: payload.priority ?? ticket.priority,
        status: payload.status ?? ticket.status
      };

      const updatePayload: IUpdateTicketRequest = {
        subject: nextTicket.subject,
        description: nextTicket.description,
        priority: nextTicket.priority,
        status: nextTicket.status
      };

      ticketDataLoader.setData(nextTicket);

      try {
        const updatedTicket = await api.tickets.updateTicket(ticketId, updatePayload);

        if (updatedTicket) {
          ticketDataLoader.setData({
            ...nextTicket,
            ...updatedTicket,
            statuses: nextTicket.statuses,
            comments: nextTicket.comments,
            references: nextTicket.references
          });
        }
      } catch (error) {
        ticketDataLoader.setData(ticket);
        throw error;
      }

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
