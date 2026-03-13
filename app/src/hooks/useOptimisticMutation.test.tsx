import { act, renderHook } from '@testing-library/react';
import { useOptimisticMutation } from './useOptimisticMutation';

describe('useOptimisticMutation', () => {
  it('applies optimistic state and commits on success', async () => {
    const setData = vi.fn();
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useOptimisticMutation<{ value: number }>({
        getData: () => ({ value: 1 }),
        setData
      })
    );

    const response = await act(async () => {
      return result.current.handleMutation(() => ({
        optimisticState: { value: 2 },
        mutation: async () => ({ ok: true }),
        onSuccess
      }));
    });

    expect(response).toEqual({ ok: true });
    expect(setData).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith({ value: 2 });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(
      { ok: true },
      {
        currentState: { value: 1 },
        optimisticState: { value: 2 }
      }
    );
  });

  it('rolls back to snapshot and rethrows when request fails', async () => {
    const error = new Error('request failed');
    const currentState = { value: 1 };
    const optimisticState = { value: 2 };
    const setData = vi.fn();

    const { result } = renderHook(() =>
      useOptimisticMutation<{ value: number }>({
        getData: () => currentState,
        setData
      })
    );

    await expect(
      act(async () => {
        await result.current.handleMutation(() => ({
          optimisticState,
          mutation: async () => {
            throw error;
          }
        }));
      })
    ).rejects.toBe(error);

    expect(setData).toHaveBeenCalledTimes(2);
    expect(setData).toHaveBeenNthCalledWith(1, optimisticState);
    expect(setData).toHaveBeenNthCalledWith(2, currentState);
  });

  it('uses default rollback and still invokes custom rollback when provided', async () => {
    const error = new Error('request failed');
    const setData = vi.fn();
    const onRollback = vi.fn();

    const { result } = renderHook(() =>
      useOptimisticMutation<{ value: number }>({
        getData: () => ({ value: 1 }),
        setData
      })
    );

    await expect(
      act(async () => {
        await result.current.handleMutation(() => ({
          optimisticState: { value: 2 },
          mutation: async () => {
            throw error;
          },
          onRollback
        }));
      })
    ).rejects.toBe(error);

    expect(setData).toHaveBeenCalledTimes(2);
    expect(setData).toHaveBeenNthCalledWith(1, { value: 2 });
    expect(setData).toHaveBeenNthCalledWith(2, { value: 1 });
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(onRollback).toHaveBeenCalledWith({
      currentState: { value: 1 },
      optimisticState: { value: 2 }
    });
  });

  it('uses latest getData and setData after rerender', async () => {
    const setDataA = vi.fn();
    const setDataB = vi.fn();

    const { result, rerender } = renderHook(({ currentValue, setData }) =>
      useOptimisticMutation<{ value: number }>({
        getData: () => ({ value: currentValue }),
        setData
      }),
    {
      initialProps: {
        currentValue: 1,
        setData: setDataA
      }
    });

    rerender({ currentValue: 10, setData: setDataB });

    await act(async () => {
      await result.current.handleMutation((currentState) => ({
        optimisticState: { value: currentState.value + 1 },
        mutation: async () => ({ ok: true })
      }));
    });

    expect(setDataA).not.toHaveBeenCalled();
    expect(setDataB).toHaveBeenCalledTimes(1);
    expect(setDataB).toHaveBeenCalledWith({ value: 11 });
  });
});
