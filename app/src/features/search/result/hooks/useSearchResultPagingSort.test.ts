import { act, renderHook } from 'test-helpers/test-utils';
import { ApiPaginationResponseParams } from 'types/pagination';
import { useSearchResultPagingSort } from './useSearchResultPagingSort';

const pagination: ApiPaginationResponseParams = {
  total: 10,
  current_page: 1,
  last_page: 1,
  sort: 'relevancy_score',
  order: 'desc'
};

describe('useSearchResultPagingSort', () => {
  it('optimistically updates the active sort before pagination refreshes', () => {
    const setSearchParams = vi.fn();

    const { result } = renderHook(() => useSearchResultPagingSort({ pagination, setSearchParams }));

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
});
