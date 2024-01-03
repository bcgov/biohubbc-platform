import { act, renderHook } from '@testing-library/react-hooks';
import { waitFor } from 'test-helpers/test-utils';
import useDebounce from './useDebounce';

const mockCallback = jest.fn();

describe('useDebounce', () => {
  it('should debounce repeated calls', async () => {
    const { result } = renderHook(() => useDebounce(mockCallback, 500));
    const debounce = result.current;
    act(() => debounce());
    await waitFor(() => {
      expect(mockCallback.mock.calls[0]).toBeDefined();
    });
    // this request should fail as it is being requested too quickly
    act(() => debounce());
    await waitFor(() => {
      expect(mockCallback.mock.calls[1]).not.toBeDefined();
    });
  });
});
