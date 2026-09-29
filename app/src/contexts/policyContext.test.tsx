import { usePolicyQuery } from 'features/admin/policies/hooks/usePolicyQuery';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { PropsWithChildren } from 'react';
import { cleanup, render, renderHook, waitFor } from 'test-helpers/test-utils';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPolicyContextProvider, IPolicyContext, PolicyContext } from './policyContext';

const { mockUseParams, mockGetPolicy } = vi.hoisted(() => ({ mockUseParams: vi.fn(), mockGetPolicy: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => mockUseParams() };
});

vi.mock('hooks/useApi', () => ({
  useApi: () => ({ policies: { getPolicy: mockGetPolicy } })
}));

const POLICY_ID = '11111111-1111-1111-1111-111111111111';

const mockPolicy = {
  policy_id: POLICY_ID,
  name: 'Sensitive Wildlife Policy',
  description: 'Policy description',
  status: PolicyStatus.APPROVED,
  statements: [],
  expressions: []
};

/**
 * Wraps a hook under test in the policy context provider.
 *
 * @param {PropsWithChildren} props The hook's host.
 * @returns {JSX.Element} The provider.
 */
const PolicyProvider = ({ children }: PropsWithChildren) => (
  <AdminPolicyContextProvider>{children}</AdminPolicyContextProvider>
);

describe('AdminPolicyContextProvider', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ policyId: POLICY_ID });
    mockGetPolicy.mockResolvedValue(mockPolicy);
  });

  it('provides the route policy id and the key its detail is cached under', () => {
    let capturedContext: IPolicyContext | undefined;
    render(
      <AdminPolicyContextProvider>
        <PolicyContext.Consumer>
          {(value) => {
            capturedContext = value;
            return null;
          }}
        </PolicyContext.Consumer>
      </AdminPolicyContextProvider>
    );

    expect(capturedContext).toEqual({ policyId: POLICY_ID, policyQueryKey: policyQueryKeys.detail(POLICY_ID) });
  });

  it('loads the route policy through usePolicyQuery', async () => {
    const { result } = renderHook(() => usePolicyQuery(), { wrapper: PolicyProvider });

    await waitFor(() => expect(result.current.data).toEqual(mockPolicy));
    expect(mockGetPolicy).toHaveBeenCalledWith(POLICY_ID, { signal: expect.any(AbortSignal) });
  });

  it('surfaces a failed load as the query error', async () => {
    const fetchError = new Error('policy fetch failed');
    mockGetPolicy.mockRejectedValueOnce(fetchError);

    const { result } = renderHook(() => usePolicyQuery(), { wrapper: PolicyProvider });

    await waitFor(() => expect(result.current.error).toBe(fetchError));
  });
});
