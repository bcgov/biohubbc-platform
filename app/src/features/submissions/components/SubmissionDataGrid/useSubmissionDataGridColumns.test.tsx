import { renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { AuthProvider } from 'react-oidc-context';
import useSubmissionDataGridColumns from './useSubmissionDataGridColumns';

const wrapper = ({ children }: PropsWithChildren) => <AuthProvider>{children}</AuthProvider>;

describe('useSubmissionDataGridColumns', () => {
  describe('mounting conditions', () => {
    it('should mount', async () => {
      const { result } = renderHook(() => useSubmissionDataGridColumns('test'), {
        wrapper
      });

      waitFor(() => {
        expect(result.current.length).toBeDefined();
      });
    });
  });
});
