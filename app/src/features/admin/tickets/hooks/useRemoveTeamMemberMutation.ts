import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ITeamMember, ITeamMembersResponse } from 'interfaces/useTeamsApi.interface';
import { cancelQueryForOptimisticUpdate } from 'utils/query-client';
import { teamQueryKeys } from 'utils/query-keys/team-query-keys';

/** A member to remove from a team. */
export interface RemoveTeamMemberVariables {
  teamId: string;
  teamMemberId: string;
}

interface RemoveTeamMemberContext {
  membersQueryKey: QueryKey;
  cancelledLoad: boolean;
  /** The removed member and where they stood, to put them back on failure. */
  removed: { member: ITeamMember; index: number } | undefined;
}

/**
 * Removes a member from a team, hiding them before the request completes.
 *
 * A failure puts the member back where they stood, unless they have reappeared since, and reports the error.
 * Removals can overlap, so every failure is reported here.
 *
 * @returns The mutation; call `mutate` with {@link RemoveTeamMemberVariables}.
 */
export const useRemoveTeamMemberMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();

  return useMutation<void, Error, RemoveTeamMemberVariables, RemoveTeamMemberContext>({
    mutationFn: ({ teamId, teamMemberId }) => api.teams.deleteTeamMember(teamId, teamMemberId),
    onMutate: async ({ teamId, teamMemberId }) => {
      const membersQueryKey = teamQueryKeys.members(teamId);
      const cancelledLoad = await cancelQueryForOptimisticUpdate(queryClient, membersQueryKey);
      const members = queryClient.getQueryData<ITeamMembersResponse>(membersQueryKey)?.members ?? [];
      const index = members.findIndex((member) => member.team_member_id === teamMemberId);
      queryClient.setQueryData<ITeamMembersResponse>(
        membersQueryKey,
        (current) =>
          current && { ...current, members: current.members.filter((member) => member.team_member_id !== teamMemberId) }
      );
      return { membersQueryKey, cancelledLoad, removed: index > -1 ? { member: members[index], index } : undefined };
    },
    onError: (error, { teamMemberId }, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      const removed = context?.removed;
      if (!removed) {
        return;
      }
      queryClient.setQueryData<ITeamMembersResponse>(context.membersQueryKey, (current) => {
        if (!current || current.members.some((member) => member.team_member_id === teamMemberId)) {
          return current;
        }
        return {
          ...current,
          members: [...current.members.slice(0, removed.index), removed.member, ...current.members.slice(removed.index)]
        };
      });
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.cancelledLoad) {
        void queryClient.invalidateQueries({ queryKey: context.membersQueryKey, exact: true });
      }
    }
  });
};
