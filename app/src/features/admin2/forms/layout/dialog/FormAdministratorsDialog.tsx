import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { OkDialog } from 'components/dialog/OkDialog';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IAvailableUser } from 'interfaces/useTeamsApi.interface';
import { useState } from 'react';

interface IFormAdministratorsDialogProps {
  /** The form administration team. */
  teamId: string;
  /** Closes the dialog. */
  onClose: () => void;
}

/**
 * Manage the members of a form's administration team, who review and approve the form's submissions. Members are
 * added and removed immediately through the existing team membership endpoints.
 *
 * @param {IFormAdministratorsDialogProps} props
 * @returns {JSX.Element} Administration team dialog.
 */
export const FormAdministratorsDialog = ({ teamId, onClose }: IFormAdministratorsDialogProps) => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();
  const [userSearch, setUserSearch] = useState('');

  const membersQueryKey = ['forms', 'administrators', teamId];
  const membersQuery = useQuery({
    queryKey: membersQueryKey,
    queryFn: ({ signal }) => biohubApi.teams.getTeamMembers(teamId, { signal })
  });
  const usersQuery = useQuery({
    queryKey: ['forms', 'administratorOptions', userSearch],
    queryFn: ({ signal }) => biohubApi.teams.getAvailableUsers(userSearch || undefined, { signal }),
    placeholderData: keepPreviousData
  });

  const members = membersQuery.data?.members ?? [];
  const userOptions = (usersQuery.data?.users ?? []).filter(
    (user) => !members.some((member) => member.system_user_id === user.system_user_id)
  );

  /**
   * Run a membership change, then refresh the members, reporting a failure through the shared error dialog.
   *
   * @param {() => Promise<unknown>} change The membership change.
   * @param {string} title Error dialog title.
   */
  const changeMembership = async (change: () => Promise<unknown>, title: string) => {
    try {
      await change();
      await queryClient.invalidateQueries({ queryKey: membersQueryKey });
    } catch (error_) {
      const apiError = error_ as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: title,
        dialogText: 'The administrators could not be changed.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        onOk: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  return (
    <>
      <QueryErrorDialog error={membersQuery.error ?? usersQuery.error} label="administrators" />
      <OkDialog
        open
        dialogTitle="Form Administrators"
        dialogText="Administrators review and approve this form's submissions."
        onClose={onClose}
        dialogContent={
          <Stack gap={2} pt={1}>
            <Autocomplete<IAvailableUser>
              options={userOptions}
              getOptionLabel={(user) => user.display_name ?? user.user_identifier}
              onInputChange={(_, value) => setUserSearch(value)}
              onChange={async (_, user) => {
                if (user) {
                  await changeMembership(
                    () => biohubApi.teams.createTeamMember(teamId, user.system_user_id),
                    'Error Adding Administrator'
                  );
                }
              }}
              value={null}
              renderInput={(params) => <TextField {...params} size="small" label="Add administrator" />}
            />
            <List dense>
              {members.map((member) => (
                <ListItem
                  key={member.team_member_id}
                  secondaryAction={
                    <IconButton
                      aria-label="Remove administrator"
                      size="small"
                      onClick={() =>
                        changeMembership(
                          () => biohubApi.teams.deleteTeamMember(teamId, member.team_member_id),
                          'Error Removing Administrator'
                        )
                      }>
                      <Icon path={mdiTrashCanOutline} size={0.7} />
                    </IconButton>
                  }>
                  <ListItemText primary={member.display_name ?? member.user_identifier} secondary={member.email} />
                </ListItem>
              ))}
            </List>
          </Stack>
        }
      />
    </>
  );
};
