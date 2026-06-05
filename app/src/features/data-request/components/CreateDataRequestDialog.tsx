import { EditDialog } from 'components/dialog/EditDialog';
import { SearchOption } from 'components/search/SearchAutocomplete.interface';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import useDebounce from 'hooks/useDebounce';
import { useEffect, useMemo } from 'react';
import { CreateDataRequestDialogYup } from './CreateDataRequestDialogYup';
import { CreateDataRequestForm, ICreateDataRequestFormValues } from './form/CreateDataRequestForm';

export interface CreateDataRequestDialogValues {
  reason: string;
  system_user_ids: number[];
}

interface ICreateDataRequestDialogProps {
  open: boolean;
  isSubmitting: boolean;
  initialReason: string;
  onCancel: () => void;
  onSave: (values: CreateDataRequestDialogValues) => void;
}

/**
 * Dialog wrapper for creating a ticket-linked data request.
 *
 * Loads selectable users, debounces user search input, and maps form values
 * to the API payload passed to `onSave`.
 *
 * @param {ICreateDataRequestDialogProps} props - Dialog props.
 * @returns {JSX.Element}
 */
export const CreateDataRequestDialog = (props: ICreateDataRequestDialogProps) => {
  const { open, isSubmitting, initialReason, onCancel, onSave } = props;
  const api = useApi();
  const dialogContext = useDialogContext();

  const availableUsersLoader = useDataLoader(
    (search?: string) => api.teams.getAvailableUsers(search),
    (error) => {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    }
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    availableUsersLoader.load();
  }, [open, availableUsersLoader]);

  const userOptions = useMemo<SearchOption[]>(
    () =>
      (availableUsersLoader.data?.users ?? []).map((user) => ({
        value: user.system_user_id,
        label: user.user_identifier
      })),
    [availableUsersLoader.data?.users]
  );

  const debouncedAvailableUserRefresh = useDebounce((search: string) => {
    availableUsersLoader.refresh(search);
  }, 300);

  return (
    <EditDialog<ICreateDataRequestFormValues>
      isLoading={isSubmitting}
      dialogTitle="Create Data Request"
      dialogSaveButtonLabel="Create"
      open={open}
      component={{
        element: (
          <CreateDataRequestForm
            options={userOptions}
            isLoadingUsers={availableUsersLoader.isLoading}
            isSubmitting={isSubmitting}
            onSearchUsers={debouncedAvailableUserRefresh}
          />
        ),
        initialValues: {
          reason: initialReason,
          system_users: []
        },
        validationSchema: CreateDataRequestDialogYup
      }}
      onCancel={onCancel}
      onSave={(values) =>
        onSave({
          reason: values.reason,
          system_user_ids: values.system_users.map((user) => user.system_user_id)
        })
      }
    />
  );
};
