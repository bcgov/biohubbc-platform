import { ITicketExtended, IUpdateTicketRequest } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { useUpdateTicketMutation } from './useUpdateTicketMutation';

interface IUseTicketEditDialogProps {
  ticket: ITicketExtended;
}

/**
 * Edit ticket dialog state and save behavior.
 *
 * @param {IUseTicketEditDialogProps} props The ticket as cached.
 * @return {*} Dialog state, whether a save is running, and the dialog handlers.
 */
export const useTicketEditDialog = (props: IUseTicketEditDialogProps) => {
  const { ticket } = props;
  const updateTicketMutation = useUpdateTicketMutation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  /**
   * Opens the edit dialog.
   *
   * @return {void}
   */
  const openEditDialog = () => setIsEditDialogOpen(true);

  /**
   * Closes the edit dialog.
   *
   * @return {void}
   */
  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
  };

  /**
   * Saves the edit, sending the subject, description and priority, and the status only when it was edited. The dialog
   * closes on success and stays open on failure, which the mutation reports.
   *
   * @param {IUpdateTicketRequest} payload The edited fields.
   * @return {void}
   */
  const handleEditTicket = (payload: IUpdateTicketRequest) => {
    const updatePayload: IUpdateTicketRequest = {
      subject: payload.subject ?? ticket.subject,
      description: payload.description === undefined ? ticket.description : payload.description,
      priority: payload.priority ?? ticket.priority
    };

    if (payload.status !== undefined) {
      updatePayload.status = payload.status;
    }

    updateTicketMutation.mutate(updatePayload, { onSuccess: () => setIsEditDialogOpen(false) });
  };

  return {
    isSavingTicket: updateTicketMutation.isPending,
    isEditDialogOpen,
    openEditDialog,
    closeEditDialog,
    handleEditTicket
  };
};
