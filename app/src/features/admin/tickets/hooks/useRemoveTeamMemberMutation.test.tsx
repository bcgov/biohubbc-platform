import { QueryObserver } from '@tanstack/react-query';
import { searchQueryKeys } from 'utils/query-keys/search-query-keys';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { ITeamMembersResponse } from 'interfaces/useTeamsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { teamQueryKeys } from 'utils/query-keys/team-query-keys';
import { useRemoveTeamMemberMutation } from './useRemoveTeamMemberMutation';

const mocks = vi.hoisted(() => ({ deleteTeamMember: vi.fn(), setSnackbar: vi.fn() }));
vi.mock('hooks/useApi', () => ({ useApi: () => ({ teams: { deleteTeamMember: mocks.deleteTeamMember } }) }));
vi.mock('hooks/useContext', () => ({ useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }) }));

const member = (id: string) => ({ team_member_id: id, system_user_id: 1, user_identifier: id, display_name: null });
const members: ITeamMembersResponse = { members: [member('a'), member('b'), member('c')] };

describe('useRemoveTeamMemberMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides the member, then puts them back where they stood when the removal fails', async () => {
    let reject!: (error: Error) => void;
    mocks.deleteTeamMember.mockReturnValue(new Promise((_, fail) => (reject = fail)));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(teamQueryKeys.members('team-1'), members);
    const { result } = renderHook(() => useRemoveTeamMemberMutation(), { queryClient });

    act(() => result.current.mutate({ teamId: 'team-1', teamMemberId: 'b' }));

    await waitFor(() =>
      expect(
        queryClient
          .getQueryData<ITeamMembersResponse>(teamQueryKeys.members('team-1'))
          ?.members.map((m) => m.team_member_id)
      ).toEqual(['a', 'c'])
    );
    await act(async () => reject(new Error('Denied')));

    await waitFor(() => expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Denied' }));
    expect(queryClient.getQueryData(teamQueryKeys.members('team-1'))).toEqual(members);
  });

  it('reloads visible search counts and discards cached feature details after access is revoked', async () => {
    mocks.deleteTeamMember.mockResolvedValue(undefined);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(teamQueryKeys.members('team-1'), members);
    const countKey = searchQueryKeys.featureCount('observation', undefined, null);
    const featureKey = submissionQueryKeys.featureDetail(1, 2);
    queryClient.setQueryData(countKey, { total: 3 });
    queryClient.setQueryData(featureKey, { feature: 'previously accessible' });
    const readCount = vi.fn().mockResolvedValue({ total: 0 });
    const stop = new QueryObserver(queryClient, {
      queryKey: countKey,
      queryFn: readCount,
      staleTime: Infinity
    }).subscribe(() => undefined);
    const { result } = renderHook(() => useRemoveTeamMemberMutation(), { queryClient });
    act(() => result.current.mutate({ teamId: 'team-1', teamMemberId: 'b' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(queryClient.getQueryData(countKey)).toEqual({ total: 0 }));
    expect(readCount).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(featureKey)).toBeUndefined();
    stop();
    queryClient.clear();
  });

  it("drops the cached teams tables once the member is removed, since they show the team's member count", async () => {
    mocks.deleteTeamMember.mockResolvedValue(undefined);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(teamQueryKeys.members('team-1'), members);
    const teamsTable = teamQueryKeys.list({ search: '' }, { page: 1, limit: 10, sort: 'name', order: 'asc' });
    queryClient.setQueryData(teamsTable, { teams: [] });
    const { result } = renderHook(() => useRemoveTeamMemberMutation(), { queryClient });

    act(() => result.current.mutate({ teamId: 'team-1', teamMemberId: 'b' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(teamsTable)).toBeUndefined();
  });
});
