import { act, renderHook } from '@testing-library/react';
import useDebouncedValue from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the latest value after the debounce delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'wolf' }
    });

    expect(result.current).toBe('wolf');

    rerender({ value: 'wolverine' });

    expect(result.current).toBe('wolf');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('wolverine');
  });

  it('supports a custom initial debounced value', () => {
    const { result } = renderHook(() => useDebouncedValue('wolf', 300, ''));

    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('wolf');
  });
});
