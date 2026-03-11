import { EditDialog } from 'components/dialog/EditDialog';
import { TICKET_PRIORITIES } from 'constants/ticket';
import { useMemo } from 'react';
import { ITicketFormValues, TicketForm } from '../form/TicketForm';
import { TicketYupSchema } from '../form/TicketYupSchema';

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
        validationSchema: TicketYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
