import { act, renderHook, waitFor } from '@testing-library/react';
import { ICompositionAutocompleteResponse } from '../dialog/CompositionOptions.interface';
import { useCompositionOptions } from './useCompositionOptions';

const firstPage: ICompositionAutocompleteResponse = {
  options: [{ id: 1, name: 'height', display_name: 'Height' }],
  pagination: { total: 26, current_page: 1, last_page: 2 }
};

/**
 * Create a controllable response for out-of-order option requests.
 */
const deferredResponse = () => {
  let resolve!: (response: ICompositionAutocompleteResponse) => void;
  const promise = new Promise<ICompositionAutocompleteResponse>((resolveResponse) => {
    resolve = resolveResponse;
  });
  return { promise, resolve };
};

describe('useCompositionOptions', () => {
  it('retains the selected label across searches without adding it to server matches', async () => {
    const fetchOptions = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValue({
        ...firstPage,
        options: [{ id: 2, name: 'width', display_name: 'Width' }]
      });
    const { result } = renderHook(() => useCompositionOptions(fetchOptions, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.onSelect(result.current.options[0]);
      result.current.onSearch('width');
    });
    await waitFor(() => expect(result.current.matchingOptions).toEqual([{ value: 2, label: 'width' }]));
    expect(result.current.options).toContainEqual({ value: 1, label: 'height' });
  });

  it('resets parent scope to page one and ignores responses for the previous parent', async () => {
    const oldResponse = deferredResponse();
    const newResponse = deferredResponse();
    const fetchOptions = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise);
    const { result, rerender } = renderHook(({ scopeId }) => useCompositionOptions(fetchOptions, true, scopeId), {
      initialProps: { scopeId: 1 }
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.onSelect(result.current.options[0]);
      result.current.onSearch('width');
    });
    await waitFor(() => expect(fetchOptions).toHaveBeenCalledTimes(2));
    rerender({ scopeId: 2 });
    expect(fetchOptions).toHaveBeenLastCalledWith('', { page: 1, limit: 10, sort: 'name', order: 'asc' });
    await act(async () => newResponse.resolve({ ...firstPage, options: [] }));
    await act(async () => oldResponse.resolve(firstPage));
    expect(result.current.options).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('does not fetch unavailable selectors and clears errors on the next request', async () => {
    const fetchOptions = vi.fn().mockRejectedValueOnce(new Error('Search failed')).mockResolvedValue(firstPage);
    const { result, rerender } = renderHook(({ enabled }) => useCompositionOptions(fetchOptions, enabled), {
      initialProps: { enabled: false }
    });
    expect(fetchOptions).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.error).toBe('Search failed'));
    act(() => result.current.onSearch('width'));
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.error).toBe('');
  });
});

it('clears dialog search and selected options on close and fetches fresh options on reopen', async () => {
  const fetchOptions = vi.fn().mockResolvedValue(firstPage);
  const { result, rerender } = renderHook(({ open }) => useCompositionOptions(fetchOptions, open), {
    initialProps: { open: false }
  });
  expect(fetchOptions).not.toHaveBeenCalled();
  rerender({ open: true });
  await waitFor(() => expect(result.current.options).toHaveLength(1));
  act(() => {
    result.current.onSelect({ value: 9, label: 'Old selection' });
    result.current.onSearch('height');
  });
  await waitFor(() => expect(fetchOptions).toHaveBeenLastCalledWith('height', expect.any(Object)));
  rerender({ open: false });
  expect(result.current.options).toEqual([]);
  fetchOptions.mockClear();
  rerender({ open: true });
  await waitFor(() => expect(result.current.options).toHaveLength(1));
  expect(fetchOptions).toHaveBeenCalledOnce();
  expect(fetchOptions).toHaveBeenCalledWith('', { page: 1, limit: 10, sort: 'name', order: 'asc' });
});
