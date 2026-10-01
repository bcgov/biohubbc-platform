import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { AuthContextProps } from 'react-oidc-context';
import { apiKeyQueryKeys } from 'utils/query-keys/api-key-query-keys';
import App from './App';

let auth: AuthContextProps;
let currentClient: QueryClient;

vi.mock('contexts/configContext', async () => ({
  ...(await vi.importActual('contexts/configContext')),
  ConfigContextProvider: ({ children }: PropsWithChildren) => children
}));
vi.mock('react-oidc-context', async () => {
  const actual = await vi.importActual<typeof import('react-oidc-context')>('react-oidc-context');
  return {
    ...actual,
    AuthProvider: ({ children }: PropsWithChildren) => (
      <actual.AuthContext.Provider value={auth}>{children}</actual.AuthContext.Provider>
    )
  };
});
vi.mock('hooks/useBiohubUserWrapper', () => ({ default: () => ({ isLoading: false, systemUserId: 1 }) }));
vi.mock('router/AppRouter', () => ({
  AppRouter: () => {
    currentClient = useQueryClient();
    return null;
  }
}));

const identity = (subject: string | null, token = 'token'): AuthContextProps =>
  ({
    isAuthenticated: subject !== null,
    isLoading: false,
    user: subject ? { profile: { sub: subject, iss: 'issuer' }, access_token: token } : null
  }) as AuthContextProps;

describe('App authentication cache boundary', () => {
  beforeEach(() => {
    auth = identity('user-a');
  });

  it('isolates private cache entries and late query and mutation responses when the identity changes', async () => {
    const { rerender } = render(<App />);
    const oldClient = currentClient;
    oldClient.setQueryData(apiKeyQueryKeys.mine(), ['user-a-key']);
    let finishRead!: (data: string) => void;
    let finishMutation!: (data: string) => void;
    const read = oldClient.fetchQuery({
      queryKey: ['late-read'],
      queryFn: () => new Promise<string>((resolve) => (finishRead = resolve))
    });
    const mutation = oldClient.getMutationCache().build(oldClient, {
      mutationFn: () => new Promise<string>((resolve) => (finishMutation = resolve)),
      onSuccess: (data) => {
        oldClient.setQueryData(['late-mutation'], data);
      }
    });
    const save = mutation.execute(undefined);
    await act(async () => {
      await Promise.resolve();
    });

    auth = identity('user-b');
    rerender(<App />);
    expect(currentClient).not.toBe(oldClient);
    expect(currentClient.getQueryData(apiKeyQueryKeys.mine())).toBeUndefined();
    expect(currentClient.getMutationCache().getAll()).toHaveLength(0);

    await act(async () => {
      finishRead('user-a-read');
      finishMutation('user-a-save');
      await Promise.all([read, save]);
    });
    expect(currentClient.getQueryData(['late-read'])).toBeUndefined();
    expect(currentClient.getQueryData(['late-mutation'])).toBeUndefined();
    oldClient.clear();
    currentClient.clear();
  });

  it('creates fresh caches on logout and when the same user signs in again', () => {
    const { rerender } = render(<App />);
    const signedInClient = currentClient;
    signedInClient.setQueryData(apiKeyQueryKeys.mine(), ['private-key']);
    auth = identity(null);
    rerender(<App />);
    const anonymousClient = currentClient;
    expect(anonymousClient.getQueryData(apiKeyQueryKeys.mine())).toBeUndefined();
    auth = identity('user-a');
    rerender(<App />);
    expect(currentClient).not.toBe(signedInClient);
    expect(currentClient).not.toBe(anonymousClient);
    expect(currentClient.getQueryData(apiKeyQueryKeys.mine())).toBeUndefined();
    signedInClient.clear();
    anonymousClient.clear();
    currentClient.clear();
  });

  it('preserves cached data through token refreshes for the same identity', () => {
    const { rerender } = render(<App />);
    const client = currentClient;
    client.setQueryData(apiKeyQueryKeys.mine(), ['private-key']);
    auth = identity('user-a', 'refreshed-token');
    rerender(<App />);
    expect(currentClient).toBe(client);
    expect(currentClient.getQueryData(apiKeyQueryKeys.mine())).toEqual(['private-key']);
    client.clear();
  });
});
