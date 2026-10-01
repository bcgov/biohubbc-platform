import { IPolicy, PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { usePolicyDetailPage } from './usePolicyDetailPage';

const mocks = vi.hoisted(() => ({
  policyId: 'policy',
  read: vi.fn(),
  status: vi.fn(),
  statement: vi.fn(),
  expressions: vi.fn(),
  snackbar: vi.fn()
}));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    policies: {
      getPolicy: mocks.read,
      updatePolicyStatus: mocks.status,
      createPolicyStatement: mocks.statement,
      getPolicyExpressions: mocks.expressions
    }
  })
}));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.snackbar }),
  usePolicyContext: () => ({ policyId: mocks.policyId, policyQueryKey: policyQueryKeys.detail(mocks.policyId) })
}));

const original: IPolicy = {
  policy_id: 'policy',
  name: 'Policy',
  description: null,
  status: PolicyStatus.REQUESTED,
  statements: [],
  expressions: []
};

describe('usePolicyDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.policyId = 'policy';
    mocks.expressions.mockResolvedValue({ expressions: [], pagination: { total: 0 } });
  });

  it.each(['page', 'policy'] as const)(
    'keeps placeholder expressions only within the same policy on %s changes',
    async (change) => {
      const queryClient = createTestQueryClient();
      const expression = {
        policy_expression_id: 'expression-a',
        policy_id: 'policy',
        expression_id: 'tree-a',
        name: 'Policy A expression',
        description: null,
        expression: { type: 'expression', operator: 'AND', clauses: [] }
      };
      queryClient.setQueryData(policyQueryKeys.detail('policy'), original);
      queryClient.setQueryData(policyQueryKeys.detail('other-policy'), { ...original, policy_id: 'other-policy' });
      queryClient.setQueryData(
        policyQueryKeys.expressions('policy', { page: 1, limit: 10, sort: 'name', order: 'asc' }),
        {
          expressions: [expression],
          pagination: { total: 11 }
        }
      );
      mocks.expressions.mockReturnValue(new Promise(() => undefined));
      const { result, rerender } = renderHook(() => usePolicyDetailPage(), { queryClient });
      expect(result.current.expressions.rows).toEqual([expression]);

      if (change === 'policy') {
        mocks.policyId = 'other-policy';
        rerender();
      } else {
        act(() => result.current.expressions.grid.handlePaginationChange({ page: 1, pageSize: 10 }));
      }

      await waitFor(() => expect(mocks.expressions).toHaveBeenCalled());
      expect(result.current.expressions.rows).toEqual(change === 'policy' ? [] : [expression]);
      expect(result.current.expressions.rowCount).toBe(change === 'policy' ? 0 : 11);
    }
  );

  it('invalidates the original policy after navigation without changing the newly opened policy', async () => {
    const queryClient = createTestQueryClient();
    const originalKey = policyQueryKeys.detail('policy');
    const otherKey = policyQueryKeys.detail('other-policy');
    const otherPolicy = { ...original, policy_id: 'other-policy' };
    queryClient.setQueryData(originalKey, original);
    queryClient.setQueryData(otherKey, otherPolicy);
    let finish!: (value: IPolicy) => void;
    mocks.status.mockReturnValue(
      new Promise<IPolicy>((resolve) => {
        finish = resolve;
      })
    );
    const { result, rerender } = renderHook(() => usePolicyDetailPage(), { queryClient });
    act(() => result.current.handlePolicyStatusChange(PolicyStatus.APPROVED));
    await waitFor(() => expect(mocks.status).toHaveBeenCalled());
    mocks.policyId = 'other-policy';
    rerender();
    await act(async () => finish({ ...original, status: PolicyStatus.APPROVED }));
    await waitFor(() => expect(queryClient.getQueryState(originalKey)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    expect(result.current.policy).toEqual(otherPolicy);
  });

  it.each(['status', 'statement'] as const)(
    'preserves a saved %s change when an older read finishes',
    async (operation) => {
      const queryClient = createTestQueryClient();
      const queryKey = policyQueryKeys.detail('policy');
      queryClient.setQueryData(queryKey, original, { updatedAt: Date.now() - 6000 });
      const statement = {
        policy_statement_id: 'statement',
        policy_id: 'policy',
        effect: 'allow' as const,
        submission_feature_urn: 'urn:*:*:*',
        policy_expression_id: null
      };
      const saved: IPolicy = { ...original };
      if (operation === 'status') {
        saved.status = PolicyStatus.APPROVED;
      } else {
        saved.statements = [statement];
      }
      let finishRead!: (policy: IPolicy) => void;
      mocks.read
        .mockReturnValueOnce(
          new Promise((resolve) => {
            finishRead = resolve;
          })
        )
        .mockResolvedValue(saved);
      mocks.status.mockResolvedValue(saved);
      mocks.statement.mockResolvedValue(statement);
      const { result } = renderHook(() => usePolicyDetailPage(), { queryClient });
      await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));

      act(() => {
        if (operation === 'status') {
          result.current.handlePolicyStatusChange(PolicyStatus.APPROVED);
        } else {
          result.current.handleCreateStatement({
            effect: 'allow',
            submission_feature_urn: 'urn:*:*:*',
            policy_expression_id: null
          });
        }
      });
      await waitFor(() => expect(result.current.policy).toEqual(saved));
      await act(async () => finishRead(original));

      await waitFor(() => expect(queryClient.isFetching({ queryKey })).toBe(0));
      expect(result.current.policy).toEqual(saved);
      expect(mocks.read).toHaveBeenCalledTimes(2);
    }
  );
});
