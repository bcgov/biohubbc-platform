import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { IUpdateTicketRequest } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

interface IUseTicketEditDialogProps {
  ticketId?: string;
  onRefreshTicket: () => Promise<void>;
}

/**
 * Edit ticket dialog state and save behavior.
 *
 * @param {IUseTicketEditDialogProps} props
 * @return {*}
 */
export const useTicketEditDialog = (props: IUseTicketEditDialogProps) => {
  const { ticketId, onRefreshTicket } = props;
  const api = useApi();

  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [editTicketError, setEditTicketError] = useState<string | undefined>();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const openEditDialog = () => setIsEditDialogOpen(true);

  const closeEditDialog = () => {
    setEditTicketError(undefined);
    setIsEditDialogOpen(false);
  };

  const handleEditTicket = async (payload: IUpdateTicketRequest) => {
    if (!ticketId) {
      return;
    }

    try {
      setIsSavingTicket(true);
      setEditTicketError(undefined);

      await api.tickets.updateTicket(ticketId, payload);
      await onRefreshTicket();
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

