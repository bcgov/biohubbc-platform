import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import useDebounce from 'hooks/useDebounce';
import {
  ICreateTicketReferenceRequest,
  ITicketReference,
  TicketRelationshipType
} from 'interfaces/useTicketsApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { TicketReferenceFormYupSchema } from './CreateDialogYup';
import { ICreateTicketReferenceFormValues, TicketReferenceForm } from './form/TicketReferenceForm';

interface ICreateTicketReferenceDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (references: ITicketReference[]) => void;
}

/**
 * Dialog wrapper for creating ticket references.
 *
 * @param {ICreateTicketReferenceDialogProps} props
 * @return {*}
 */
export const CreateTicketReferenceDialog = (props: ICreateTicketReferenceDialogProps) => {
  const { open, onClose, onSubmit } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId } = useTicketContext();
  const [ticketSearch, setTicketSearch] = useState('');
  const ticketOptionsParams = {
    search: ticketSearch || undefined,
    page: 1,
    limit: 50,
    sort: 'create_date',
    order: 'desc' as const
  };

  const ticketOptionsQuery = useQuery({
    queryKey: ticketQueryKeys.list('admin', ticketOptionsParams),
    queryFn: ({ signal }) => api.tickets.getTicketsForAdmin(ticketOptionsParams, { signal }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const { error: ticketOptionsError } = ticketOptionsQuery;
  useEffect(() => {
    if (ticketOptionsError) {
      dialogContext.setSnackbar({ open: true, snackbarMessage: ticketOptionsError.message });
    }
  }, [dialogContext, ticketOptionsError]);

  const handleTicketSearch = useDebounce(setTicketSearch, 300);

  const createReferenceMutation = useMutation({
    mutationFn: (request: ICreateTicketReferenceRequest) => api.tickets.createTicketReference(ticketId, request),
    onSuccess: (createdReferences) => {
      onSubmit?.(createdReferences);
      onClose();
    },
    onError: (error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });

  const ticketOptions: ICustomMultiAutocompleteOption[] = useMemo(
    () =>
      (ticketOptionsQuery.data?.tickets ?? [])
        .filter((ticket) => ticket.ticket_id !== ticketId)
        .map((ticket) => ({
          value: ticket.ticket_id,
          label: `#${ticket.ticket_slug} ${ticket.subject}`
        })),
    [ticketOptionsQuery.data?.tickets, ticketId]
  );

  /**
   * Creates a reference to each chosen ticket; the dialog closes on success and stays open on failure.
   *
   * @param {ICreateTicketReferenceFormValues} values The relationship and target tickets.
   * @return {void}
   */
  const handleSubmit = (values: ICreateTicketReferenceFormValues) => {
    createReferenceMutation.mutate({
      references: values.target_ticket_ids.map((targetTicketId) => ({
        target_ticket_id: targetTicketId,
        relationship: values.relationship as TicketRelationshipType
      }))
    });
  };

  return (
    <EditDialog<ICreateTicketReferenceFormValues>
      isLoading={createReferenceMutation.isPending}
      dialogTitle="Create Reference"
      dialogSaveButtonLabel="Create"
      open={open}
      component={{
        element: <TicketReferenceForm ticketOptions={ticketOptions} onTicketSearch={handleTicketSearch} />,
        initialValues: {
          source_ticket_id: ticketId,
          relationship: 'relates_to',
          target_ticket_ids: []
        },
        validationSchema: TicketReferenceFormYupSchema
      }}
      onCancel={onClose}
      onSave={handleSubmit}
    />
  );
};
