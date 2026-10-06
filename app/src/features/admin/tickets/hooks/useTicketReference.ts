import { reconcileAfterMutations } from 'hooks/useCoordinatedMutation';
import { useQueryClient } from '@tanstack/react-query';
import { useTicketContext } from 'hooks/useContext';
import { ITicketExtended, ITicketReference } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
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
   * Appends the references the dialog created to the cached ticket, refreshes the other cached details of every ticket
   * they link, and closes the dialog.
   *
   * @param {ITicketReference[]} createdReferences References returned by the create request.
   * @returns {Promise<void>} Resolves after the cache write and any immediate refresh.
   */
  const handleCreateReferenceSubmit = async (createdReferences: ITicketReference[]) => {
    if (!createdReferences.length) {
      return;
    }

    const hadPendingRead = queryClient.isFetching({ queryKey: ticketQueryKey, exact: true }) > 0;
    await queryClient.cancelQueries({ queryKey: ticketQueryKey, exact: true });
    queryClient.setQueryData<ITicketExtended>(ticketQueryKey, (ticket) => {
      if (!ticket) {
        return ticket;
      }
      const createdIds = new Set(createdReferences.map((reference) => reference.ticket_reference_id));
      return {
        ...ticket,
        references: [
          ...ticket.references.filter((reference) => !createdIds.has(reference.ticket_reference_id)),
          ...createdReferences
        ]
      };
    });
    if (hadPendingRead) {
      await reconcileAfterMutations(queryClient, ticketQueryKey, ticketQueryKey);
    }
    await refreshChangedQueries(
      queryClient,
      createdReferences.flatMap(changedQueryKeys.ticketReference),
      ticketQueryKey
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
