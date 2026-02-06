import { act, renderHook } from '@testing-library/react';
import useDebounce from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('debounce timing', () => {
    it('delays callback execution until after delay period', () => {
      // WHY HIGH VALUE: Tests core debounce timing behavior
      const mockCallback = vi.fn();

      const { result } = renderHook(() => useDebounce(mockCallback, 300));

      // Step 1: Call the debounced function
      act(() => {
        result.current();
      });

      // Step 2: Verify callback NOT called immediately
      expect(mockCallback).not.toHaveBeenCalled();

      // Step 3: Advance time past delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Step 4: Verify callback was called
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('cancels previous call when called again within delay', () => {
      // WHY HIGH VALUE: Tests debounce cancellation - only last call should execute
      const mockCallback = vi.fn();

      const { result } = renderHook(() => useDebounce(mockCallback, 300));

      // Step 1: Call multiple times rapidly
      act(() => {
        result.current();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current();
      });

      // Step 2: Advance past original delay (but not past second call's delay)
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Step 3: First call should have been cancelled
      expect(mockCallback).not.toHaveBeenCalled();

      // Step 4: Advance past second call's delay
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Step 5: Only the last call should execute
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('parameter passing', () => {
    it('passes arguments through to callback', () => {
      // WHY HIGH VALUE: Tests new generic parameter functionality
      const mockCallback = vi.fn<(term: string, count: number) => void>();

      const { result } = renderHook(() => useDebounce(mockCallback, 300));

      // Step 1: Call with arguments
      act(() => {
        result.current('search term', 42);
      });

      // Step 2: Advance past delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Step 3: Verify callback received the arguments
      expect(mockCallback).toHaveBeenCalledWith('search term', 42);
    });

    it('passes latest arguments when called multiple times', () => {
      // WHY HIGH VALUE: Tests that only the last call's arguments are used
      const mockCallback = vi.fn<(term: string) => void>();

      const { result } = renderHook(() => useDebounce(mockCallback, 300));

      // Step 1: Call multiple times with different arguments
      act(() => {
        result.current('first');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current('second');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current('third');
      });

      // Step 2: Advance past delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Step 3: Only the last call's arguments should be used
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('third');
    });
  });

  describe('callback ref pattern', () => {
    it('always calls the latest callback', () => {
      // WHY HIGH VALUE: Tests the ref pattern - ensures callback updates are picked up
      // This is critical for callbacks that capture changing state
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      // Step 1: Render with first callback
      const { result, rerender } = renderHook(({ cb }) => useDebounce(cb, 300), {
        initialProps: { cb: firstCallback }
      });

      // Step 2: Call the debounced function
      act(() => {
        result.current();
      });

      // Step 3: Update to second callback BEFORE delay completes
      rerender({ cb: secondCallback });

      // Step 4: Advance past delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Step 5: Second callback should be called (not first)
      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('function identity', () => {
    it('returns stable function when callback changes', () => {
      // WHY HIGH VALUE: Tests that debounced function doesn't change on every render
      // This prevents unnecessary re-renders in consuming components
      const { result, rerender } = renderHook<ReturnType<typeof useDebounce>, { cb: () => void }>(
        ({ cb }) => useDebounce(cb, 300),
        { initialProps: { cb: vi.fn() } }
      );

      const firstResult = result.current;

      // Step 1: Rerender with different callback
      rerender({ cb: vi.fn() });

      // Step 2: Function identity should be stable
      expect(result.current).toBe(firstResult);
    });

    it('returns new function when delay changes', () => {
      // WHY HIGH VALUE: Tests that delay changes are respected
      const mockCallback = vi.fn();

      const { result, rerender } = renderHook(({ delay }) => useDebounce(mockCallback, delay), {
        initialProps: { delay: 300 }
      });

      const firstResult = result.current;

      // Step 1: Rerender with different delay
      rerender({ delay: 500 });

      // Step 2: Function should be recreated with new delay
      expect(result.current).not.toBe(firstResult);
    });
  });
});
