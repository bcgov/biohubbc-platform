import EditDialog from 'components/dialog/EditDialog';
import { useCodesContext } from 'hooks/useContext';
import { ITicketWithHistory, IUpdateTicketRequest, TicketPriority } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import yup from 'utils/YupSchema';
import { IAutocompleteOption, ITicketFormValues, TicketForm } from './form/TicketForm';

interface IEditTicketDialogProps {
  open: boolean;
  ticket: ITicketWithHistory;
  isSaving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (payload: IUpdateTicketRequest) => Promise<void>;
}

/**
 * Dialog wrapper for editing existing ticket values using the shared TicketForm.
 *
 * @param {IEditTicketDialogProps} props
 * @return {*}
 */
export const EditTicketDialog = (props: IEditTicketDialogProps) => {
  const { open, ticket, isSaving, error, onClose, onSave } = props;
  const { codesDataLoader } = useCodesContext();

  const ticketPriorityOptions = useMemo<IAutocompleteOption[]>(
    () =>
      (codesDataLoader.data?.ticket_priorities ?? []).map((value) => ({
        value,
        label: value
      })),
    [codesDataLoader.data?.ticket_priorities]
  );

  const editTicketFormYupSchema = useMemo(() => {
    const validPriorities = ticketPriorityOptions.map((option) => option.value);

    return yup.object().shape({
      title: yup.string().required('Subject is required').max(100, 'Subject must be 100 characters or less'),
      description: yup.string().max(2000, 'Description must be 2000 characters or less'),
      priority: yup
        .mixed<TicketPriority>()
        .required('Priority is required')
        .test('is-valid-priority', 'Priority is required', (value) => {
          return Boolean(value) && (validPriorities.length === 0 || validPriorities.includes(value));
        })
    });
  }, [ticketPriorityOptions]);

  const initialValues = useMemo<ITicketFormValues>(
    () => ({
      title: ticket.title,
      description: ticket.description ?? '',
      priority: ticket.priority
    }),
    [ticket.description, ticket.priority, ticket.title]
  );

  const handleSave = async (values: ITicketFormValues) => {
    await onSave({
      title: values.title.trim(),
      description: values.description.trim() || null,
      priority: values.priority
    });
  };

  return (
    <EditDialog<ITicketFormValues>
      isLoading={isSaving}
      dialogTitle="Edit Ticket"
      dialogSaveButtonLabel="Save"
      open={open}
      component={{
        element: <TicketForm priorities={ticketPriorityOptions} />,
        initialValues,
        validationSchema: editTicketFormYupSchema
      }}
      dialogError={error}
      onCancel={onClose}
      onSave={handleSave}
    />
  );
};
