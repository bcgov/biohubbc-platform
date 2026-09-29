import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IAvailableUser, ITeamMember, ITeamMembersResponse } from 'interfaces/useTeamsApi.interface';
import { cancelQueryForOptimisticUpdate } from 'utils/query-client';
import { teamQueryKeys } from 'utils/query-keys/team-query-keys';

/** A user to add to a team. */
export interface AddTeamMemberVariables {
  teamId: string;
  user: IAvailableUser;
}

interface AddTeamMemberContext {
  membersQueryKey: QueryKey;
  cancelledLoad: boolean;
  /** The placeholder member as cached. */
  placeholder: ITeamMember | undefined;
}

/**
 * Adds a user to a team, listing them before the request completes.
 *
 * On success the placeholder is replaced by the member the server created. A failure removes the placeholder and
 * reports the error. Additions can overlap, so every failure is reported here.
 *
 * @returns The mutation; call `mutate` with {@link AddTeamMemberVariables}.
 */
export const useAddTeamMemberMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();

  return useMutation<ITeamMember, Error, AddTeamMemberVariables, AddTeamMemberContext>({
    mutationFn: ({ teamId, user }) => api.teams.createTeamMember(teamId, user.system_user_id),
    onMutate: async ({ teamId, user }) => {
      const membersQueryKey = teamQueryKeys.members(teamId);
      const cancelledLoad = await cancelQueryForOptimisticUpdate(queryClient, membersQueryKey);
      const placeholderId = `optimistic-${user.system_user_id}-${Date.now()}`;
      const response = queryClient.setQueryData<ITeamMembersResponse>(membersQueryKey, (current) => ({
        ...current,
        members: [
          ...(current?.members ?? []),
          {
            team_member_id: placeholderId,
            system_user_id: user.system_user_id,
            user_identifier: user.user_identifier,
            display_name: user.display_name
          }
        ]
      }));
      return {
        membersQueryKey,
        cancelledLoad,
        placeholder: response?.members.find((member) => member.team_member_id === placeholderId)
      };
    },
    onSuccess: (created, _variables, context) => {
      queryClient.setQueryData<ITeamMembersResponse>(context.membersQueryKey, (current) => {
        if (!current) {
          return current;
        }
        const alreadyListed = current.members.some((member) => member.team_member_id === created.team_member_id);
        return {
          ...current,
          members: alreadyListed
            ? current.members.filter((member) => member !== context.placeholder)
            : current.members.map((member) => (member === context.placeholder ? created : member))
        };
      });
    },
    onError: (error, _variables, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      if (!context) {
        return;
      }
      queryClient.setQueryData<ITeamMembersResponse>(
        context.membersQueryKey,
        (current) =>
          current && { ...current, members: current.members.filter((member) => member !== context.placeholder) }
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.cancelledLoad) {
        void queryClient.invalidateQueries({ queryKey: context.membersQueryKey, exact: true });
      }
    }
  });
};
