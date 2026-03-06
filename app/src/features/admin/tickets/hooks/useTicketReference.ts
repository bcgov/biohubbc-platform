import { APIError } from 'hooks/api/useAxios';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { useApi } from 'hooks/useApi';
import { ITicketReference } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

/**
 * Dialog state and submit behavior for creating ticket references.
 *
 * @return {*}
 */
export const useTicketReference = () => {
  const api = useApi();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const dialogContext = useDialogContext();

  const [isSubmittingReference, setIsSubmittingReference] = useState(false);
  const [isCreateReferenceDialogOpen, setIsCreateReferenceDialogOpen] = useState(false);

  const openCreateReferenceDialog = () => setIsCreateReferenceDialogOpen(true);

  const closeCreateReferenceDialog = () => {
    setIsCreateReferenceDialogOpen(false);
  };

  const handleCreateReferenceSubmit = (createdReferences: ITicketReference[]) => {
    if (!createdReferences.length) {
      return;
    }

    const latestTicket = ticketDataLoader.data;
    if (!latestTicket) {
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      references: [...latestTicket.references, ...createdReferences]
    });
    setIsCreateReferenceDialogOpen(false);
  };

  const handleDeleteReference = async (ticketReferenceId: string) => {
    const currentTicket = ticketDataLoader.data;

    if (!currentTicket) {
      return;
    }

    const removedReferenceIndex = currentTicket.references.findIndex(
      (reference) => reference.ticket_reference_id === ticketReferenceId
    );
    const removedReference = removedReferenceIndex > -1 ? currentTicket.references[removedReferenceIndex] : undefined;

    if (!removedReference) {
      return;
    }

    try {
      setIsSubmittingReference(true);

      const latestTicketForDelete = ticketDataLoader.data;
      if (latestTicketForDelete) {
        ticketDataLoader.setData({
          ...latestTicketForDelete,
          references: latestTicketForDelete.references.filter(
            (reference) => reference.ticket_reference_id !== ticketReferenceId
          )
        });
      }

      await api.tickets.deleteTicketReference(ticketId, ticketReferenceId);
    } catch (caughtError) {
      const latestTicketForDeleteRollback = ticketDataLoader.data;
      if (latestTicketForDeleteRollback) {
        const nextReferences = [...latestTicketForDeleteRollback.references];
        nextReferences.splice(Math.max(0, removedReferenceIndex), 0, removedReference);

        ticketDataLoader.setData({
          ...latestTicketForDeleteRollback,
          references: nextReferences
        });
      }

      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSubmittingReference(false);
    }
  };

  return {
    isSubmittingReference,
    isCreateReferenceDialogOpen,
    openCreateReferenceDialog,
    closeCreateReferenceDialog,
    handleCreateReferenceSubmit,
    handleDeleteReference
  };
};
