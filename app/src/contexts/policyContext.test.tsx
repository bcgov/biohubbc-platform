import { waitFor } from '@testing-library/react';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { ComponentType, PropsWithChildren } from 'react';
import { cleanup, render } from 'test-helpers/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPolicyContextProvider, IPolicyContext, PolicyContext } from './policyContext';

const { mockUseParams, mockPoliciesApi, mockUseApi } = vi.hoisted(() => {
  const useParams = vi.fn();

  const policiesApi = {
    getPolicy: vi.fn()
  };

  const useApi = vi.fn(() => ({ policies: policiesApi }));

  return { mockUseParams: useParams, mockPoliciesApi: policiesApi, mockUseApi: useApi };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => mockUseParams() };
});

vi.mock('hooks/useApi', () => ({
  useApi: () => mockUseApi()
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

type ProviderHarness = {
  getContext: () => IPolicyContext;
};

const renderProvider = (Provider: ComponentType<PropsWithChildren>): ProviderHarness => {
  let capturedContext: IPolicyContext | undefined;

  render(
    <Provider>
      <PolicyContext.Consumer>
        {(value) => {
          capturedContext = value;
          return null;
        }}
      </PolicyContext.Consumer>
    </Provider>
  );

  return {
    getContext: () => {
      if (!capturedContext) {
        throw new Error('PolicyContext was never provided');
      }

      return capturedContext;
    }
  };
};

describe('AdminPolicyContextProvider', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ policyId: POLICY_ID });
    mockPoliciesApi.getPolicy.mockResolvedValue(mockPolicy);
  });

  it('exposes the policyId from route params in context', async () => {
    const { getContext } = renderProvider(AdminPolicyContextProvider);

    await waitFor(() => {
      expect(getContext().policyId).toBe(POLICY_ID);
    });
  });

  it('exposes a policyDataLoader in context', async () => {
    const { getContext } = renderProvider(AdminPolicyContextProvider);

    await waitFor(() => {
      expect(getContext().policyDataLoader).toBeDefined();
    });
  });

  it('calls getPolicy with the policyId on mount', async () => {
    renderProvider(AdminPolicyContextProvider);

    await waitFor(() => {
      expect(mockPoliciesApi.getPolicy).toHaveBeenCalledWith(POLICY_ID);
    });
  });

  it('surfaces policy data in the data loader after a successful fetch', async () => {
    const { getContext } = renderProvider(AdminPolicyContextProvider);

    await waitFor(() => {
      expect(getContext().policyDataLoader.data).toEqual(mockPolicy);
    });
  });

  it('surfaces the error in the data loader when the fetch fails', async () => {
    const fetchError = new Error('policy fetch failed');
    mockPoliciesApi.getPolicy.mockRejectedValueOnce(fetchError);

    const { getContext } = renderProvider(AdminPolicyContextProvider);

    await waitFor(() => {
      expect(getContext().policyDataLoader.error).toBe(fetchError);
    });
  });
});
