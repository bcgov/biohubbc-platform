import { EditDialog } from 'components/dialog/EditDialog';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ITicket, IUpdateTicketRequest, TicketPriority } from 'interfaces/useTicketsApi.interface';
import { useMemo, useState } from 'react';
import { ITicketFormValues, TicketForm } from '../form/TicketForm';
import { EditTicketFormYupSchema } from './EditDialogYup';

const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical'];

interface IEditTicketDialogProps {
  open: boolean;
  ticket: ITicket;
  onClose: () => void;
  onSubmit?: (ticket: ITicket) => void;
}

/**
 * Dialog wrapper for editing existing ticket values using the shared TicketForm.
 *
 * @param {IEditTicketDialogProps} props
 * @return {*}
 */
export const EditTicketDialog = (props: IEditTicketDialogProps) => {
  const { open, ticket, onClose, onSubmit } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ticketPriorityOptions = useMemo(
    () =>
      TICKET_PRIORITIES.map((value) => ({
        value,
        label: value
      })),
    []
  );

  const initialValues = useMemo<ITicketFormValues>(
    () => ({
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority
    }),
    [ticket.description, ticket.priority, ticket.subject]
  );

  const handleSubmit = async (values: ITicketFormValues) => {
    const payload: IUpdateTicketRequest = {
      subject: values.subject,
      description: values.description,
      priority: values.priority
    };

    try {
      setIsSubmitting(true);
      const updatedTicket = await api.tickets.updateTicket(ticket.ticket_id, payload);
      onSubmit?.(updatedTicket);
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
    <EditDialog<ITicketFormValues>
      isLoading={isSubmitting}
      dialogTitle="Edit Ticket"
      dialogSaveButtonLabel="Save"
      open={open}
      component={{
        element: <TicketForm priorities={ticketPriorityOptions} />,
        initialValues,
        validationSchema: EditTicketFormYupSchema
      }}
      onCancel={onClose}
      onSave={handleSubmit}
    />
  );
};
