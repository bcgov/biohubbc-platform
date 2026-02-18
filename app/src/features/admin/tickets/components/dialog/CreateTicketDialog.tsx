import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import EditDialog from 'components/dialog/EditDialog';
import CustomTextField from 'components/fields/CustomTextField';
import { useFormikContext } from 'formik';
import { ICreateTicketRequest, TicketPriority } from 'interfaces/useTicketsApi.interface';
import yup from 'utils/YupSchema';

interface ICreateTicketDialogProps {
  open: boolean;
  isSaving: boolean;
  error?: string;
  onClose: () => void;
  onCreate: (payload: ICreateTicketRequest) => Promise<void>;
}

interface ICreateTicketFormValues {
  title: string;
  description: string;
  priority: TicketPriority;
}

const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const CreateTicketFormInitialValues: ICreateTicketFormValues = {
  title: '',
  description: '',
  priority: 'MEDIUM'
};

const CreateTicketFormYupSchema = yup.object().shape({
  title: yup.string().required('Title is required').max(100, 'Title must be 100 characters or less'),
  description: yup.string().max(2000, 'Description must be 2000 characters or less'),
  priority: yup.mixed<TicketPriority>().oneOf(PRIORITIES).required('Priority is required')
});

/**
 * Form body rendered inside the shared EditDialog for ticket creation.
 *
 * @return {*}
 */
const CreateTicketForm = () => {
  const { values } = useFormikContext<ICreateTicketFormValues>();

  return (
    <Stack gap={2} sx={{ pt: 1 }}>
      <CustomTextField label="Title" name="title" other={{ required: true, inputProps: { maxLength: 100 } }} />
      <CustomTextField
        label="Description"
        name="description"
        other={{ multiline: true, minRows: 3, inputProps: { maxLength: 2000 } }}
      />
      <CustomTextField label="Priority" name="priority" other={{ select: true, value: values.priority }}>
        {PRIORITIES.map((value) => (
          <MenuItem key={value} value={value}>
            {value}
          </MenuItem>
        ))}
      </CustomTextField>
    </Stack>
  );
};

/**
 * Dialog wrapper for creating tickets using the shared EditDialog pattern.
 *
 * @param {ICreateTicketDialogProps} props
 * @return {*}
 */
export const CreateTicketDialog = (props: ICreateTicketDialogProps) => {
  const { open, onClose, onCreate, isSaving, error } = props;

  const handleSave = async (values: ICreateTicketFormValues) => {
    await onCreate({
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      priority: values.priority
    });
  };

  return (
    <EditDialog<ICreateTicketFormValues>
      isLoading={isSaving}
      dialogTitle="Create Ticket"
      dialogSaveButtonLabel="Create Ticket"
      open={open}
      component={{
        element: <CreateTicketForm />,
        initialValues: CreateTicketFormInitialValues,
        validationSchema: CreateTicketFormYupSchema
      }}
      dialogError={error}
      onCancel={onClose}
      onSave={handleSave}
    />
  );
};
