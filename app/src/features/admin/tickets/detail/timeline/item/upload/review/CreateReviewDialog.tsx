import { EditDialog } from 'components/dialog/EditDialog';
import { SubmissionUploadReviewScope } from 'interfaces/useTicketsApi.interface';
import { CreateReviewForm } from './CreateReviewForm';
import { type ICreateReviewFormValues } from './CreateReviewForm.interface';
import { CreateReviewFormYupSchema } from './CreateReviewFormYupSchema';

interface ICreateReviewDialogProps {
  scope: SubmissionUploadReviewScope;
  isLoading: boolean;
  onCancel: () => void;
  onSave: (values: ICreateReviewFormValues) => void;
}

/**
 * Dialog for naming and describing a new submission upload review.
 *
 * @param {ICreateReviewDialogProps} props - Component props.
 * @returns {JSX.Element} Create review dialog.
 */
export const CreateReviewDialog = (props: ICreateReviewDialogProps) => {
  const { scope, isLoading, onCancel, onSave } = props;
  const scopeLabel = scope === 'security' ? 'Security' : 'Validation';

  return (
    <EditDialog<ICreateReviewFormValues>
      open
      isLoading={isLoading}
      dialogTitle={`Create ${scopeLabel} Review`}
      dialogSaveButtonLabel="Create"
      component={{
        element: <CreateReviewForm />,
        initialValues: {
          name: '',
          description: ''
        },
        validationSchema: CreateReviewFormYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
