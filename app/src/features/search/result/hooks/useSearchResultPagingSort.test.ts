import { act, renderHook } from 'test-helpers/test-utils';
import { useSearchResultPagingSort } from './useSearchResultPagingSort';

describe('useSearchResultPagingSort', () => {
  it('optimistically updates the active sort before pagination refreshes', () => {
    const setSearchParams = vi.fn();

    const { result } = renderHook(() =>
      useSearchResultPagingSort({
        cursor: {
          limit: 10,
          sort: 'relevancy_score',
          order: 'desc',
          next: 'next-token',
          previous: null
        },
        currentPage: 1,
        setSearchParams
      })
    );

    act(() => {
      result.current.handleSortChange('create_date', 'desc');
    });

    expect(result.current.activeSort).toBe('create_date');
    expect(result.current.sortOptions).toContainEqual({
      label: 'Date',
      value: 'create_date',
      direction: 'desc'
    });
    expect(setSearchParams).toHaveBeenCalledWith({ sort: 'create_date', order: 'desc' }, true);
  });

  it('uses the returned keyset cursor for the next page', () => {
    const setSearchParams = vi.fn();
    const { result } = renderHook(() =>
      useSearchResultPagingSort({
        cursor: {
          limit: 10,
          sort: 'relevancy_score',
          order: 'desc',
          next: 'next-token',
          previous: null
        },
        currentPage: 1,
        setSearchParams
      })
    );

    act(() => result.current.handlePageChange(2));

    expect(setSearchParams).toHaveBeenCalledWith({ page: '2', cursor: 'next-token' });
  });
});
