import { act, renderHook } from '@testing-library/react';
import { useOptimisticDataLoader } from './useOptimisticDataLoader';

describe('useOptimisticDataLoader', () => {
  it('applies optimistic data and commits on success', async () => {
    const dataLoader = {
      data: { value: 1 },
      setData: vi.fn((nextData: { value: number }) => {
        dataLoader.data = nextData;
      })
    };
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useOptimisticDataLoader(dataLoader));

    const response = await act(async () => {
      return result.current.refresh((state) => ({
        optimisticState: { value: state.value + 1 },
        mutation: async () => ({ ok: true }),
        onSuccess
      }));
    });

    expect(response).toEqual({ ok: true });
    expect(dataLoader.setData).toHaveBeenCalledTimes(1);
    expect(dataLoader.setData).toHaveBeenCalledWith({ value: 2 });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('passes current and optimistic state context to mutation and onSuccess', async () => {
    const mutation = vi.fn(async () => ({ ok: true }));
    const onSuccess = vi.fn();
    const dataLoader = {
      data: { value: 1 },
      setData: vi.fn((nextData: { value: number }) => {
        dataLoader.data = nextData;
      })
    };

    const { result } = renderHook(() => useOptimisticDataLoader(dataLoader));

    await act(async () => {
      await result.current.refresh((state) => ({
        optimisticState: { value: state.value + 1 },
        mutation,
        onSuccess
      }));
    });

    expect(mutation).toHaveBeenCalledWith({
      currentState: { value: 1 },
      optimisticState: { value: 2 }
    });
    expect(onSuccess).toHaveBeenCalledWith(
      { ok: true },
      {
        currentState: { value: 1 },
        optimisticState: { value: 2 }
      }
    );
  });

  it('rolls back and rethrows when request fails', async () => {
    const error = new Error('request failed');
    const dataLoader = {
      data: { value: 1 },
      setData: vi.fn((nextData: { value: number }) => {
        dataLoader.data = nextData;
      })
    };
    const rollback = vi.fn(({ currentState }) => {
      dataLoader.setData(currentState);
    });

    const { result } = renderHook(() => useOptimisticDataLoader(dataLoader));

    await expect(
      act(async () => {
        await result.current.refresh(() => ({
          optimisticState: { value: 2 },
          mutation: async () => {
            throw error;
          },
          onRollback: rollback
        }));
      })
    ).rejects.toBe(error);

    expect(dataLoader.setData).toHaveBeenCalledTimes(3);
    expect(dataLoader.setData).toHaveBeenNthCalledWith(1, { value: 2 });
    expect(dataLoader.setData).toHaveBeenNthCalledWith(2, { value: 1 });
    expect(dataLoader.setData).toHaveBeenNthCalledWith(3, { value: 1 });
    expect(rollback).toHaveBeenCalledWith({
      currentState: { value: 1 },
      optimisticState: { value: 2 }
    });
  });

  it('returns undefined when current data is unavailable', async () => {
    const dataLoader = {
      data: undefined as { value: number } | undefined,
      setData: vi.fn()
    };

    const { result } = renderHook(() => useOptimisticDataLoader(dataLoader));

    const response = await act(async () => {
      return result.current.refresh((currentData) => ({
        optimisticState: { value: currentData.value + 1 },
        mutation: async () => ({ ok: true }),
        onSuccess: vi.fn(),
        onRollback: vi.fn()
      }));
    });

    expect(response).toBeUndefined();
    expect(dataLoader.setData).not.toHaveBeenCalled();
  });

  it('supports valid falsy data values', async () => {
    const dataLoader = {
      data: 0,
      setData: vi.fn((nextData: number) => {
        dataLoader.data = nextData;
      })
    };

    const { result } = renderHook(() => useOptimisticDataLoader(dataLoader));

    const response = await act(async () => {
      return result.current.refresh((currentData) => ({
        optimisticState: currentData + 1,
        mutation: async () => ({ ok: true })
      }));
    });

    expect(response).toEqual({ ok: true });
    expect(dataLoader.setData).toHaveBeenCalledWith(1);
  });
});
