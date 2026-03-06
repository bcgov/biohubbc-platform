import Stack from '@mui/material/Stack';
import { APIError } from 'hooks/api/useAxios';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketReference } from 'interfaces/useTicketsApi.interface';
import { CreateTicketReferenceDialog } from '../../components/dialog/reference/CreateTicketReferenceDialog';
import { useTicketReference } from '../../hooks/useTicketReference';
import { formatRelationship } from '../../utils/formatRelationship';
import { TicketSidebarItem } from './TicketSidebarItem';
import { TicketSidebarSection } from './TicketSidebarSection';

interface ITicketSidebarReferencesProps {
  references: ITicketReference[];
}

/**
 * Ticket reference section and create dialog wiring.
 *
 * @param {ITicketSidebarReferencesProps} props
 * @return {*}
 */
export const TicketSidebarReferences = (props: ITicketSidebarReferencesProps) => {
  const { references } = props;
  const dialogContext = useDialogContext();
  const { ticketId } = useTicketContext();
  const {
    isSubmittingReference,
    isCreateReferenceDialogOpen,
    openCreateReferenceDialog,
    closeCreateReferenceDialog,
    handleCreateReferenceSubmit,
    handleDeleteReference
  } = useTicketReference();

  return (
    <>
      <TicketSidebarSection label="References" onAdd={openCreateReferenceDialog}>
        <Stack spacing={0.75}>
          {references.map((reference) => {
            const isSourceReference = reference.source_ticket_id === ticketId;
            const relatedTicketSlug = isSourceReference ? reference.target_ticket_slug : reference.source_ticket_slug;
            const relatedTicketSubject = isSourceReference
              ? reference.target_ticket_subject
              : reference.source_ticket_subject;
            const relatedTicketId = isSourceReference ? reference.target_ticket_id : reference.source_ticket_id;

            return (
              <TicketSidebarItem
                key={reference.ticket_reference_id}
                label={`${formatRelationship(reference.relationship)} #${relatedTicketSlug}: ${relatedTicketSubject}`}
                href={`/admin/tickets/${relatedTicketId}`}
                isDisabled={isSubmittingReference}
                onRemove={() => {
                  const removeReference = async () => {
                    try {
                      await handleDeleteReference(reference.ticket_reference_id);
                    } catch (caughtError) {
                      const apiError = caughtError as APIError;
                      dialogContext.setSnackbar({
                        open: true,
                        snackbarMessage: apiError.message
                      });
                    }
                  };

                  removeReference();
                }}
              />
            );
          })}
        </Stack>
      </TicketSidebarSection>

      <CreateTicketReferenceDialog
        open={isCreateReferenceDialogOpen}
        onClose={closeCreateReferenceDialog}
        onSubmit={handleCreateReferenceSubmit}
      />
    </>
  );
};
