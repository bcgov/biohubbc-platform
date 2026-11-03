import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { useDialogContext } from 'hooks/useContext';
import { useApi } from 'hooks/useApi';
import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';
import yup from 'utils/YupSchema';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import {
  ISubmissionDefaultBlueprintFormValues,
  SubmissionDefaultBlueprintForm
} from './SubmissionDefaultBlueprintForm';

const submissionDefaultBlueprintFormSchema = yup.object({
  blueprintId: yup.number().nullable().required('Select a blueprint')
});

interface SubmissionDefaultBlueprintDialogProps {
  open: boolean;
  submissionId: number;
  blueprint: IBlueprint | null;
  onClose: () => void;
}

/**
 * Dialog for editing the single blueprint a submission's future uploads use by default. The selection is held in the
 * form until saved; saving a different blueprint refreshes the default the Metadata tab reads. Existing uploads keep
 * the blueprint they were created with.
 *
 * @param {SubmissionDefaultBlueprintDialogProps} props Submission, its current default blueprint and dialog state.
 * @returns {JSX.Element} Blueprint edit dialog with Save and Cancel actions.
 */
export const SubmissionDefaultBlueprintDialog = (props: SubmissionDefaultBlueprintDialogProps) => {
  const { open, submissionId, blueprint, onClose } = props;
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const blueprintMutation = useMutation({
    mutationFn: (blueprintId: number) => api.admin.updateSubmissionDefaultBlueprint(submissionId, blueprintId)
  });

  /**
   * Save the selected blueprint as the submission's default, then refresh the default shown on the page.
   *
   * @param {ISubmissionDefaultBlueprintFormValues} values Validated blueprint selection.
   * @returns {Promise<void>} Resolves after the change is saved or its error is shown in a snackbar.
   */
  const handleSave = async (values: ISubmissionDefaultBlueprintFormValues) => {
    // Validation guarantees a selection; an unchanged one needs no request.
    if (values.blueprintId === null || values.blueprintId === blueprint?.blueprint_id) {
      onClose();
      return;
    }

    try {
      await blueprintMutation.mutateAsync(values.blueprintId);
      await queryClient.invalidateQueries({ queryKey: submissionQueryKeys.defaultBlueprint(submissionId) });
      onClose();
      setSnackbar({ open: true, snackbarMessage: 'Default blueprint updated' });
    } catch (error) {
      setSnackbar({ open: true, snackbarMessage: (error as Error).message });
    }
  };

  return (
    <EditDialog<ISubmissionDefaultBlueprintFormValues>
      open={open}
      dialogTitle="Edit default blueprint"
      isLoading={blueprintMutation.isPending}
      maxWidth="md"
      onCancel={onClose}
      onSave={handleSave}
      component={{
        element: <SubmissionDefaultBlueprintForm currentBlueprint={blueprint} />,
        initialValues: { blueprintId: blueprint?.blueprint_id ?? null },
        validationSchema: submissionDefaultBlueprintFormSchema
      }}
    />
  );
};
