import { EditDialog } from 'components/dialog/EditDialog';
import { TICKET_PRIORITIES } from 'constants/ticket';
import { ITicket, IUpdateTicketRequest } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import { ITicketFormValues, TicketForm } from '../form/TicketForm';
import { TicketYupSchema } from '../form/TicketYupSchema';

interface IEditTicketDialogProps {
  open: boolean;
  isLoading: boolean;
  ticket: ITicket;
  onClose: () => void;
  onSubmit: (payload: IUpdateTicketRequest) => Promise<void>;
}

/**
 * Dialog wrapper for editing existing ticket values using the shared TicketForm.
 *
 * @param {IEditTicketDialogProps} props
 * @return {*}
 */
export const EditTicketDialog = (props: IEditTicketDialogProps) => {
  const { open, isLoading, ticket, onClose, onSubmit } = props;

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

  return (
    <EditDialog<ITicketFormValues>
      isLoading={isLoading}
      dialogTitle="Edit Ticket"
      dialogSaveButtonLabel="Save"
      open={open}
      component={{
        element: <TicketForm priorities={ticketPriorityOptions} />,
        initialValues,
        validationSchema: TicketYupSchema
      }}
      onCancel={onClose}
      onSave={onSubmit}
    />
  );
};
