import EditDialog from 'components/dialog/EditDialog';
import { ICreateTicketRequest, TicketPriority } from 'interfaces/useTicketsApi.interface';
import yup from 'utils/YupSchema';
import { ITicketFormValues, TICKET_PRIORITIES, TicketForm } from './form/TicketForm';

interface ICreateTicketDialogProps {
  open: boolean;
  isSaving: boolean;
  error?: string;
  onClose: () => void;
  onCreate: (payload: ICreateTicketRequest) => Promise<void>;
}

const CreateTicketFormInitialValues: ITicketFormValues = {
  title: '',
  description: '',
  priority: 'MEDIUM'
};

const CreateTicketFormYupSchema = yup.object().shape({
  title: yup.string().required('Title is required').max(100, 'Title must be 100 characters or less'),
  description: yup.string().max(2000, 'Description must be 2000 characters or less'),
  priority: yup.mixed<TicketPriority>().oneOf(TICKET_PRIORITIES).required('Priority is required')
});

/**
 * Dialog wrapper for creating tickets using the shared EditDialog pattern.
 *
 * @param {ICreateTicketDialogProps} props
 * @return {*}
 */
export const CreateTicketDialog = (props: ICreateTicketDialogProps) => {
  const { open, onClose, onCreate, isSaving, error } = props;

  const handleSave = async (values: ITicketFormValues) => {
    await onCreate({
      title: values.title.trim(),
      description: values.description.trim() || null,
      priority: values.priority
    });
  };

  return (
    <EditDialog<ITicketFormValues>
      isLoading={isSaving}
      dialogTitle="Create Ticket"
      dialogSaveButtonLabel="Create"
      open={open}
      component={{
        element: <TicketForm />,
        initialValues: CreateTicketFormInitialValues,
        validationSchema: CreateTicketFormYupSchema
      }}
      dialogError={error}
      onCancel={onClose}
      onSave={handleSave}
    />
  );
};
