import { useQueryClient } from '@tanstack/react-query';
import { useTicketContext } from 'hooks/useContext';
import { ITicketExtended, ITicketReference } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { useDeleteTicketReferenceMutation } from './useDeleteTicketReferenceMutation';

/**
 * Dialog state and cache writes for creating and deleting ticket references.
 *
 * @return {*}
 */
export const useTicketReference = () => {
  const queryClient = useQueryClient();
  const { ticketQueryKey } = useTicketContext();
  const deleteReferenceMutation = useDeleteTicketReferenceMutation();
  const [isCreateReferenceDialogOpen, setIsCreateReferenceDialogOpen] = useState(false);

  /**
   * Opens the create-reference dialog.
   *
   * @return {void}
   */
  const openCreateReferenceDialog = () => setIsCreateReferenceDialogOpen(true);

  /**
   * Closes the create-reference dialog.
   *
   * @return {void}
   */
  const closeCreateReferenceDialog = () => {
    setIsCreateReferenceDialogOpen(false);
  };

  /**
   * Appends the references the dialog created to the cached ticket and closes the dialog.
   *
   * @param {ITicketReference[]} createdReferences References returned by the create request.
   * @return {void}
   */
  const handleCreateReferenceSubmit = (createdReferences: ITicketReference[]) => {
    if (!createdReferences.length) {
      return;
    }

    queryClient.setQueryData<ITicketExtended>(
      ticketQueryKey,
      (ticket) => ticket && { ...ticket, references: [...ticket.references, ...createdReferences] }
    );
    setIsCreateReferenceDialogOpen(false);
  };

  /**
   * Deletes a reference, hiding it until the request completes; the mutation restores and reports a failure.
   *
   * @param {string} ticketReferenceId Reference to delete.
   * @return {void}
   */
  const handleDeleteReference = (ticketReferenceId: string) => {
    deleteReferenceMutation.mutate(ticketReferenceId);
  };

  return {
    isSubmittingReference: deleteReferenceMutation.isPending,
    isCreateReferenceDialogOpen,
    openCreateReferenceDialog,
    closeCreateReferenceDialog,
    handleCreateReferenceSubmit,
    handleDeleteReference
  };
};
