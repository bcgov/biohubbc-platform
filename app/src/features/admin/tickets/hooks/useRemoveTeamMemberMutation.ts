import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ITeamMember, ITeamMembersResponse } from 'interfaces/useTeamsApi.interface';
import {
  cancelQueryForOptimisticUpdate,
  joinMutationGroup,
  refreshChangedQueries,
  settleMutationGroup
} from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { teamQueryKeys } from 'utils/query-keys/team-query-keys';

/** A member to remove from a team. */
export interface RemoveTeamMemberVariables {
  teamId: string;
  teamMemberId: string;
}

interface RemoveTeamMemberContext {
  membersQueryKey: QueryKey;
  /** The removed member and where they stood, to put them back on failure. */
  removed: { member: ITeamMember; index: number } | undefined;
}

/**
 * Removes a member from a team, hiding them before the request completes.
 *
 * On success the teams tables, which show member counts, are refreshed.
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
    // Every membership change shares this key, so reloads of the members wait for the last of them.
    mutationKey: teamQueryKeys.membershipChanges(),
    mutationFn: ({ teamId, teamMemberId }) => api.teams.deleteTeamMember(teamId, teamMemberId),
    onMutate: async ({ teamId, teamMemberId }) => {
      const membersQueryKey = teamQueryKeys.members(teamId);
      joinMutationGroup(queryClient, teamQueryKeys.membershipChanges());
      await cancelQueryForOptimisticUpdate(queryClient, membersQueryKey, teamQueryKeys.membershipChanges());
      const members = queryClient.getQueryData<ITeamMembersResponse>(membersQueryKey)?.members ?? [];
      const index = members.findIndex((member) => member.team_member_id === teamMemberId);
      queryClient.setQueryData<ITeamMembersResponse>(
        membersQueryKey,
        (current) =>
          current && { ...current, members: current.members.filter((member) => member.team_member_id !== teamMemberId) }
      );
      return { membersQueryKey, removed: index > -1 ? { member: members[index], index } : undefined };
    },
    onSuccess: () => refreshChangedQueries(queryClient, changedQueryKeys.teamMembership()),
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
    onSettled: () => settleMutationGroup(queryClient, teamQueryKeys.membershipChanges())
  });
};
