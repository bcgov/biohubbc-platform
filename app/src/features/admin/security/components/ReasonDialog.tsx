import { EditDialog } from 'components/dialog/EditDialog';
import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import useDataLoader from 'hooks/useDataLoader';
import { useApi } from 'hooks/useApi';
import { useEffect, useMemo } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
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

const CATEGORY_OPTIONS_PAGINATION: ApiPaginationRequestOptions = {
  page: 1,
  limit: 100,
  sort: 'name',
  order: 'asc'
};

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

  const categoriesDataLoader = useDataLoader(
    (search?: string) => biohubApi.security.getSecurityCategories({ search }, CATEGORY_OPTIONS_PAGINATION),
    (error) => onLoadError('Failed to Load Categories', 'An error occurred while loading categories.', error)
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    categoriesDataLoader.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const categoryOptions: ICustomAutocompleteOption<number>[] = useMemo(
    () =>
      (categoriesDataLoader.data?.categories ?? []).map((category) => ({
        label: category.name,
        value: category.security_category_id
      })),
    [categoriesDataLoader.data?.categories]
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
