import { APIError } from 'hooks/api/useAxios';
import { ITicketWithHistory, IUpdateTicketRequest } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

interface IUseTicketEditDialogProps {
  ticket?: ITicketWithHistory;
  onUpdateTicket: (nextTicket: ITicketWithHistory) => Promise<void>;
}

/**
 * Edit ticket dialog state and save behavior.
 *
 * @param {IUseTicketEditDialogProps} props
 * @return {*}
 */
export const useTicketEditDialog = (props: IUseTicketEditDialogProps) => {
  const { ticket, onUpdateTicket } = props;

  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [editTicketError, setEditTicketError] = useState<string | undefined>();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const openEditDialog = () => setIsEditDialogOpen(true);

  const closeEditDialog = () => {
    setEditTicketError(undefined);
    setIsEditDialogOpen(false);
  };

  const handleEditTicket = async (payload: IUpdateTicketRequest) => {
    if (!ticket) {
      return;
    }

    try {
      setIsSavingTicket(true);
      setEditTicketError(undefined);

      const nextTicket: ITicketWithHistory = {
        ...ticket,
        title: payload.title ?? ticket.title,
        description: payload.description === undefined ? ticket.description : payload.description,
        priority: payload.priority ?? ticket.priority,
        status: payload.status ?? ticket.status
      };

      await onUpdateTicket(nextTicket);
      setIsEditDialogOpen(false);
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      setEditTicketError(apiError.message || 'Failed to update ticket.');
    } finally {
      setIsSavingTicket(false);
    }
  };

  return {
    isSavingTicket,
    editTicketError,
    isEditDialogOpen,
    openEditDialog,
    closeEditDialog,
    handleEditTicket
  };
};
