import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { SearchOption } from 'components/search/SearchAutocomplete.interface';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDebounce from 'hooks/useDebounce';
import { useEffect, useMemo, useState } from 'react';
import { userQueryKeys } from 'utils/query-keys/user-query-keys';
import { getUserLabel } from 'utils/Utils';
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

  const [userSearch, setUserSearch] = useState('');

  const availableUsersQuery = useQuery({
    queryKey: userQueryKeys.available(userSearch),
    queryFn: ({ signal }) => api.teams.getAvailableUsers(userSearch, { signal }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const { error: availableUsersError } = availableUsersQuery;
  useEffect(() => {
    if (availableUsersError) {
      dialogContext.setSnackbar({ open: true, snackbarMessage: availableUsersError.message });
    }
  }, [availableUsersError, dialogContext]);

  const availableUsers = useMemo(() => availableUsersQuery.data?.users ?? [], [availableUsersQuery.data?.users]);
  const userOptions = useMemo<SearchOption[]>(
    () =>
      availableUsers.map((user) => ({
        value: user.system_user_id,
        label: getUserLabel(user)
      })),
    [availableUsers]
  );

  const debouncedUserSearch = useDebounce(setUserSearch, 300);

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
            availableUsers={availableUsers}
            isLoadingUsers={availableUsersQuery.isFetching}
            isSubmitting={isSubmitting}
            onSearchUsers={debouncedUserSearch}
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
