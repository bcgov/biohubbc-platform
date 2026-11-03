import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import {
  ISubmissionDefaultBlueprintFormValues,
  SubmissionDefaultBlueprintForm
} from 'features/submissions/components/dialog/SubmissionDefaultBlueprintForm';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { SubmissionUploadScope } from 'interfaces/useAdminApi.interface';
import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import yup from 'utils/YupSchema';
import { adminSubmissionUploadQueryKeys } from '../../submission-upload-query-keys';

const reindexSubmissionUploadFormSchema = yup.object({
  blueprintId: yup.number().nullable().required('Select a blueprint')
});

interface ReindexSubmissionUploadDialogProps {
  open: boolean;
  scope: SubmissionUploadScope;
  blueprint: IBlueprint | null;
  onClose: () => void;
}

/**
 * Dialog for re-indexing an upload with the blueprint it already uses or another one. Saving queues the re-index and
 * refreshes the upload, whose status reads `reconciled` until the index job finishes. The server decides whether the
 * upload can be re-indexed and whether the blueprint can be used; its reason is shown when it refuses.
 *
 * @param {ReindexSubmissionUploadDialogProps} props Upload, its current blueprint and dialog state.
 * @returns {JSX.Element} Blueprint selection dialog with Reindex and Cancel actions.
 */
export const ReindexSubmissionUploadDialog = (props: ReindexSubmissionUploadDialogProps) => {
  const { open, scope, blueprint, onClose } = props;
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const reindexMutation = useMutation({
    mutationFn: (blueprintId: number) => api.admin.reindexSubmissionUpload(scope, blueprintId)
  });

  /**
   * Queue the re-index with the selected blueprint, then refresh the upload and the submission's upload list.
   *
   * @param {ISubmissionDefaultBlueprintFormValues} values Validated blueprint selection.
   * @returns {Promise<void>} Resolves after the re-index is queued or its error is shown in a snackbar.
   */
  const handleReindex = async (values: ISubmissionDefaultBlueprintFormValues) => {
    // Validation guarantees a selection.
    if (values.blueprintId === null) {
      return;
    }

    try {
      await reindexMutation.mutateAsync(values.blueprintId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminSubmissionUploadQueryKeys.all(scope) }),
        queryClient.invalidateQueries({ queryKey: submissionQueryKeys.adminUploadLists(scope.submissionId) })
      ]);
      onClose();
      setSnackbar({ open: true, snackbarMessage: 'Reindex started' });
    } catch (error) {
      setSnackbar({ open: true, snackbarMessage: (error as Error).message });
    }
  };

  return (
    <EditDialog<ISubmissionDefaultBlueprintFormValues>
      open={open}
      dialogTitle="Reindex upload"
      dialogSaveButtonLabel="Reindex"
      isLoading={reindexMutation.isPending}
      maxWidth="md"
      onCancel={onClose}
      onSave={handleReindex}
      component={{
        element: (
          <>
            <Typography variant="body2" color="text.secondary">
              Rebuilds the upload&apos;s validation errors and property values with the selected blueprint, then re-runs
              automatic security screening. Keep the current blueprint to re-run indexing as it is.
            </Typography>
            <SubmissionDefaultBlueprintForm currentBlueprint={blueprint} />
          </>
        ),
        initialValues: { blueprintId: blueprint?.blueprint_id ?? null },
        validationSchema: reindexSubmissionUploadFormSchema
      }}
    />
  );
};
