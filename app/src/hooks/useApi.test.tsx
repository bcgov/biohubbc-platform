import { renderHook } from '@testing-library/react';
import { useApi } from './useApi';

vi.mock('hooks/useContext', () => ({
  useConfigContext: () => ({ API_HOST: 'http://localhost:6100' })
}));

const auth = { user: { access_token: 'token' }, signinSilent: vi.fn() };

vi.mock('react-oidc-context', () => ({
  useAuth: () => auth
}));

describe('useApi', () => {
  it('returns the same api object across renders while the axios instance is unchanged', () => {
    const { result, rerender } = renderHook(() => useApi());
    const initial = result.current;

    rerender();

    expect(result.current).toBe(initial);
    expect(result.current.tickets).toBe(initial.tickets);
    expect(result.current.tickets.getSubmissionUploadProcessingStatusHistory).toBe(
      initial.tickets.getSubmissionUploadProcessingStatusHistory
    );
  });
});
