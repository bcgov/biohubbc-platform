import { act, renderHook } from '@testing-library/react';
import { useServerPaginatedGridState } from './useServerPaginatedGridState';

const defaultOptions = { defaultSort: { field: 'name', sort: 'asc' as const } };

describe('useServerPaginatedGridState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts on the first page with the default sort and page size', () => {
    const { result } = renderHook(() => useServerPaginatedGridState({ ...defaultOptions, defaultPageSize: 25 }));

    expect(result.current.paginationModel).toEqual({ page: 0, pageSize: 25 });
    expect(result.current.sortModel).toEqual([{ field: 'name', sort: 'asc' }]);
    expect(result.current.apiPagination).toEqual({ page: 1, limit: 25, sort: 'name', order: 'asc' });
  });

  it('derives one-based API pagination from page and sort changes', () => {
    const { result } = renderHook(() => useServerPaginatedGridState(defaultOptions));

    act(() => {
      result.current.handlePaginationChange({ page: 2, pageSize: 50 });
      result.current.handleSortChange([{ field: 'created', sort: 'desc' }]);
    });

    expect(result.current.apiPagination).toEqual({ page: 3, limit: 50, sort: 'created', order: 'desc' });
  });

  it('keeps apiPagination referentially stable across unrelated renders', () => {
    const { result, rerender } = renderHook(() => useServerPaginatedGridState(defaultOptions));
    const initial = result.current.apiPagination;

    rerender();

    expect(result.current.apiPagination).toBe(initial);
  });

  it('updates the search input immediately and applies the term after the debounce', () => {
    const { result } = renderHook(() => useServerPaginatedGridState(defaultOptions));

    act(() => {
      result.current.handleSearch('moose');
    });

    expect(result.current.searchTerm).toBe('moose');
    expect(result.current.debouncedSearchTerm).toBe('');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearchTerm).toBe('moose');
  });

  it('returns to the first page in the same update that applies a search term', () => {
    const { result } = renderHook(() => useServerPaginatedGridState(defaultOptions));

    act(() => {
      result.current.handlePaginationChange({ page: 3, pageSize: 10 });
    });
    act(() => {
      result.current.handleSearch('elk');
    });

    expect(result.current.paginationModel.page).toBe(3);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearchTerm).toBe('elk');
    expect(result.current.paginationModel).toEqual({ page: 0, pageSize: 10 });
  });

  it('applies only the last term typed within the debounce window', () => {
    const { result } = renderHook(() => useServerPaginatedGridState(defaultOptions));

    act(() => {
      result.current.handleSearch('c');
      result.current.handleSearch('ca');
      result.current.handleSearch('caribou');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearchTerm).toBe('caribou');
  });

  it('cancels a pending search when unmounted', () => {
    const { result, unmount } = renderHook(() => useServerPaginatedGridState(defaultOptions));

    act(() => {
      result.current.handleSearch('bear');
    });
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
