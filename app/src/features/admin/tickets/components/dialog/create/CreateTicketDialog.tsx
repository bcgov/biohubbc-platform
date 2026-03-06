import { EditDialog } from 'components/dialog/EditDialog';
import { TicketPriority } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import { ITicketFormValues, TicketForm } from '../form/TicketForm';
import { CreateTicketFormYupSchema } from './CreateDialogYup';

const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical'];

interface ICreateTicketDialogProps {
  open: boolean;
  isLoading: boolean;
  onCancel: () => void;
  onSave: (values: ITicketFormValues) => void;
}

const CreateTicketFormInitialValues: ITicketFormValues = {
  subject: '',
  description: null,
  priority: 'medium'
};

/**
 * Dialog wrapper for creating tickets using the shared EditDialog pattern.
 *
 * @param {ICreateTicketDialogProps} props
 * @return {*}
 */
export const CreateTicketDialog = (props: ICreateTicketDialogProps) => {
  const { open, isLoading, onCancel, onSave } = props;

  const ticketPriorityOptions = useMemo(
    () =>
      TICKET_PRIORITIES.map((value) => ({
        value,
        label: value
      })),
    []
  );

  return (
    <EditDialog<ITicketFormValues>
      isLoading={isLoading}
      dialogTitle="Create Ticket"
      dialogSaveButtonLabel="Create"
      open={open}
      component={{
        element: <TicketForm priorities={ticketPriorityOptions} />,
        initialValues: CreateTicketFormInitialValues,
        validationSchema: CreateTicketFormYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
