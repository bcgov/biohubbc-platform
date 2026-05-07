import { EditDialog } from 'components/dialog/EditDialog';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { CreateDownloadForm, ICreateDownloadFormValues } from './CreateDownloadForm';
import { CreateDownloadFormYup } from './CreateDownloadFormYup';

interface ICreateDownloadDialogProps {
  open: boolean;
  isSubmitting: boolean;
  defaultName: string;
  defaultFeatureType: string;
  featureTypeOptions: ICustomMultiAutocompleteOption[];
  onCancel: () => void;
  onSave: (values: ICreateDownloadFormValues) => void;
}

/**
 * Dialog wrapper for creating a download. Thin layer over `EditDialog` that wires the form +
 * Yup schema and seeds initial values from the search route's anchor (page title and the
 * route's primary feature type).
 *
 * Submit lifecycle (in-flight flag, snackbars, sidebar switching) is owned by the parent page,
 * not this dialog.
 */
export const CreateDownloadDialog = (props: ICreateDownloadDialogProps) => {
  const { open, isSubmitting, defaultName, defaultFeatureType, featureTypeOptions, onCancel, onSave } = props;

  const initialValues: ICreateDownloadFormValues = {
    name: defaultName,
    description: null,
    featureTypes: [defaultFeatureType]
  };

  return (
    <EditDialog<ICreateDownloadFormValues>
      open={open}
      isLoading={isSubmitting}
      dialogTitle="Create Download"
      dialogSaveButtonLabel="Create"
      component={{
        element: <CreateDownloadForm featureTypeOptions={featureTypeOptions} />,
        initialValues,
        validationSchema: CreateDownloadFormYup
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
