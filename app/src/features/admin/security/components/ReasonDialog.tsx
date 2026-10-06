import { useQuery } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import { SECURITY_CATEGORY_OPTIONS_PAGINATION } from 'constants/security';
import { useApi } from 'hooks/useApi';
import { useEffect, useMemo } from 'react';
import { securityQueryKeys } from 'utils/query-keys/security-query-keys';
import { AddReasonForm, AddReasonFormYupSchema, IAddReasonFormValues } from './AddReasonForm';

export { AddReasonFormInitialValues } from './AddReasonForm';

/**
 * Props for the ReasonDialog component.
 */
export interface IReasonDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Whether a save operation is in progress */
  isLoading: boolean;
  /** Dialog title text */
  dialogTitle: string;
  /** Label for the save button */
  dialogSaveButtonLabel: string;
  /** Initial Formik values for the reason form */
  initialValues: IAddReasonFormValues;
  /** Callback when category options fail to load */
  onLoadError: (title: string, text: string, error: unknown) => void;
  /** Callback when the dialog is cancelled */
  onCancel: () => void;
  /** Callback when the form is submitted successfully */
  onSave: (values: IAddReasonFormValues) => void;
}

/**
 * Dialog for creating or editing a security reason.
 *
 * Loads active security categories when opened and wraps AddReasonForm in EditDialog.
 *
 * @param {IReasonDialogProps} props
 * @returns {React.ReactElement}
 */
export const ReasonDialog = (props: IReasonDialogProps) => {
  const { open, isLoading, dialogTitle, dialogSaveButtonLabel, initialValues, onLoadError, onCancel, onSave } = props;
  const biohubApi = useApi();

  const categoriesQuery = useQuery({
    queryKey: securityQueryKeys.categories({}, SECURITY_CATEGORY_OPTIONS_PAGINATION),
    queryFn: ({ signal }) =>
      biohubApi.security.getSecurityCategories({}, SECURITY_CATEGORY_OPTIONS_PAGINATION, { signal }),
    enabled: open
  });

  const { error: categoriesError } = categoriesQuery;
  useEffect(() => {
    if (categoriesError) {
      onLoadError('Failed to Load Categories', 'An error occurred while loading categories.', categoriesError);
    }
  }, [categoriesError, onLoadError]);

  const categoryOptions: ICustomAutocompleteOption<number>[] = useMemo(
    () =>
      (categoriesQuery.data?.categories ?? []).map((category) => ({
        label: category.name,
        value: category.security_category_id
      })),
    [categoriesQuery.data?.categories]
  );

  return (
    <EditDialog<IAddReasonFormValues>
      open={open}
      isLoading={isLoading}
      dialogTitle={dialogTitle}
      dialogSaveButtonLabel={dialogSaveButtonLabel}
      component={{
        element: <AddReasonForm categoryOptions={categoryOptions} />,
        initialValues,
        validationSchema: AddReasonFormYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
