import { EditDialog } from 'components/dialog/EditDialog';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import useDebounce from 'hooks/useDebounce';
import {
  ICreateTicketReferenceRequest,
  ITicketReference,
  TicketRelationshipType
} from 'interfaces/useTicketsApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ticketOptionsLoader = useDataLoader(
    (search?: string) =>
      api.tickets.getTicketsForAdmin({ search, page: 1, limit: 50, sort: 'create_date', order: 'desc' }),
    (error) => {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    }
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    ticketOptionsLoader.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const debouncedTicketRefresh = useDebounce((search: string) => {
    ticketOptionsLoader.refresh(search);
  }, 300);

  const handleTicketSearch = useCallback(
    (search: string) => {
      debouncedTicketRefresh(search);
    },
    [debouncedTicketRefresh]
  );

  const ticketOptions: ICustomMultiAutocompleteOption[] = useMemo(
    () =>
      (ticketOptionsLoader.data?.tickets ?? [])
        .filter((ticket) => ticket.ticket_id !== ticketId)
        .map((ticket) => ({
          value: ticket.ticket_id,
          label: `#${ticket.ticket_slug} ${ticket.subject}`
        })),
    [ticketOptionsLoader.data?.tickets, ticketId]
  );

  const handleSubmit = async (values: ICreateTicketReferenceFormValues) => {
    const request: ICreateTicketReferenceRequest = {
      references: values.target_ticket_ids.map((targetTicketId) => ({
        target_ticket_id: targetTicketId,
        relationship: values.relationship as TicketRelationshipType
      }))
    };

    try {
      setIsSubmitting(true);
      const createdReferences = await api.tickets.createTicketReference(ticketId, request);
      onSubmit?.(createdReferences);
      onClose();
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <EditDialog<ICreateTicketReferenceFormValues>
      isLoading={isSubmitting}
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
