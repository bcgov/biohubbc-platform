import { EditDialog } from 'components/dialog/EditDialog';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import useDebounce from 'hooks/useDebounce';
import { CreateTicketDataRequestPayload } from 'interfaces/useDataRequestApi.interface';
import { useEffect, useMemo } from 'react';
import { CreateDataRequestDialogYup } from './CreateDataRequestDialogYup';
import { CreateDataRequestForm, ICreateDataRequestFormValues } from './form/CreateDataRequestForm';

interface ICreateDataRequestDialogProps {
  open: boolean;
  isSubmitting: boolean;
  initialReason: string;
  onCancel: () => void;
  onSave: (values: CreateTicketDataRequestPayload) => void;
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

  const userOptions = useMemo<SidebarOption[]>(
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

  const handleAvailableUserSearch = (search: string) => {
    debouncedAvailableUserRefresh(search);
  };

  const handleSave = (values: ICreateDataRequestFormValues) => {
    onSave({
      reason: values.reason.trim(),
      system_user_ids: values.system_user_ids
    });
  };

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
            onSearchUsers={handleAvailableUserSearch}
          />
        ),
        initialValues: {
          reason: initialReason,
          system_user_ids: [],
          system_users: []
        },
        validationSchema: CreateDataRequestDialogYup
      }}
      onCancel={onCancel}
      onSave={handleSave}
    />
  );
};
