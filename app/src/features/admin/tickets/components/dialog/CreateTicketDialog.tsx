import EditDialog from 'components/dialog/EditDialog';
import { useCodesContext } from 'hooks/useContext';
import { ICreateTicketRequest, TicketPriority } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import yup from 'utils/YupSchema';
import { IAutocompleteOption, ITicketFormValues, TicketForm } from './form/TicketForm';

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
  priority: 'medium'
};

/**
 * Dialog wrapper for creating tickets using the shared EditDialog pattern.
 *
 * @param {ICreateTicketDialogProps} props
 * @return {*}
 */
export const CreateTicketDialog = (props: ICreateTicketDialogProps) => {
  const { open, onClose, onCreate, isSaving, error } = props;
  const { codesDataLoader } = useCodesContext();
  const ticketPriorityOptions = useMemo<IAutocompleteOption[]>(
    () =>
      (codesDataLoader.data?.ticket_priorities ?? []).map((value) => ({
        value,
        label: value
      })),
    [codesDataLoader.data?.ticket_priorities]
  );

  const createTicketFormYupSchema = useMemo(() => {
    const validPriorities = ticketPriorityOptions.map((option) => option.value);

    return yup.object().shape({
      title: yup.string().required('Title is required').max(100, 'Title must be 100 characters or less'),
      description: yup.string().max(2000, 'Description must be 2000 characters or less'),
      priority: yup
        .mixed<TicketPriority>()
        .required('Priority is required')
        .test('is-valid-priority', 'Priority is required', (value) => {
          return Boolean(value) && (validPriorities.length === 0 || validPriorities.includes(value));
        })
    });
  }, [ticketPriorityOptions]);

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
        element: <TicketForm priorities={ticketPriorityOptions} />,
        initialValues: CreateTicketFormInitialValues,
        validationSchema: createTicketFormYupSchema
      }}
      dialogError={error}
      onCancel={onClose}
      onSave={handleSave}
    />
  );
};
