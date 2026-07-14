import { EditDialog } from 'components/dialog/EditDialog';
import { CreateDownloadDialogYup } from './CreateDownloadDialogYup';
import { CreateDownloadForm, ICreateDownloadFormValues } from './CreateDownloadForm';

interface ICreateDownloadDialogProps {
  open: boolean;
  isSubmitting: boolean;
  defaultName: string;
  onCancel: () => void;
  onSave: (values: ICreateDownloadFormValues) => void;
}

/**
 * Dialog wrapper for creating a download. Thin layer over `EditDialog` that wires the form +
 * Yup schema and seeds the initial display name from the search route.
 *
 * Submit lifecycle (in-flight flag, snackbars, sidebar switching) is owned by the parent page,
 * not this dialog.
 */
export const CreateDownloadDialog = (props: ICreateDownloadDialogProps) => {
  const { open, isSubmitting, defaultName, onCancel, onSave } = props;

  const initialValues: ICreateDownloadFormValues = {
    name: defaultName,
    description: null
  };

  return (
    <EditDialog<ICreateDownloadFormValues>
      open={open}
      isLoading={isSubmitting}
      dialogTitle="Create Download"
      dialogSaveButtonLabel="Create"
      component={{
        element: <CreateDownloadForm />,
        initialValues,
        validationSchema: CreateDownloadDialogYup
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
