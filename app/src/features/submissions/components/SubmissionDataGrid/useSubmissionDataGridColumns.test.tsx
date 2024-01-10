import { renderHook } from '@testing-library/react-hooks';
import { PropsWithChildren } from 'react';
import { AuthProvider } from 'react-oidc-context';
import useSubmissionDataGridColumns from './useSubmissionDataGridColumns';

const wrapper = ({ children }: PropsWithChildren) => <AuthProvider>{children}</AuthProvider>;

describe('useSubmissionDataGridColumns', () => {
  describe('mounting conditions', () => {
    it('should mount', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useSubmissionDataGridColumns('test'), {
        wrapper
      });
      await waitForNextUpdate();
      expect(result.current.length).toBeDefined();
    });
  });
});
