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
});
