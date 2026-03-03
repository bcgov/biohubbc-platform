import { act, renderHook } from '@testing-library/react';
import { toApiPagination } from 'utils/pagination';
import { useServerPaginatedDataGrid } from './useServerPaginatedDataGrid';

// Mock useDataLoader
const mockLoad = vi.fn();
const mockRefresh = vi.fn();
vi.mock('./useDataLoader', () => ({
  default: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    load: mockLoad,
    refresh: mockRefresh
  }))
}));

// Import the mocked module to control return values
import useDataLoader from './useDataLoader';
const mockUseDataLoader = vi.mocked(useDataLoader);

// Test data types
interface ITestItem {
  id: string;
  name: string;
}

interface ITestResponse {
  items: ITestItem[];
  pagination: { total: number };
}

// Default hook options for tests
const createDefaultOptions = (overrides = {}) => ({
  fetcher: vi.fn<(search: string, pagination: any) => Promise<ITestResponse>>().mockResolvedValue({
    items: [{ id: '1', name: 'Test' }],
    pagination: { total: 1 }
  }),
  extractData: (response: ITestResponse) => response.items,
  extractTotal: (response: ITestResponse) => response.pagination.total,
  defaultSort: { field: 'name', sort: 'asc' as const },
  ...overrides
});

describe('useServerPaginatedDataGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Reset useDataLoader mock to default
    mockUseDataLoader.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isReady: false,
      load: mockLoad,
      refresh: mockRefresh,
      clear: vi.fn(),
      setData: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('toApiPagination helper', () => {
    it('converts 0-indexed page to 1-indexed API page', () => {
      // WHY HIGH VALUE: Tests critical page index conversion that could cause off-by-one bugs
      const result = toApiPagination({ page: 0, pageSize: 10 }, [{ field: 'name', sort: 'asc' }]);

      expect(result.page).toBe(1);
    });

    it('passes pageSize as limit', () => {
      const result = toApiPagination({ page: 0, pageSize: 25 }, [{ field: 'name', sort: 'asc' }]);

      expect(result.limit).toBe(25);
    });

    it('extracts sort field and order from sort model', () => {
      const result = toApiPagination({ page: 0, pageSize: 10 }, [{ field: 'created_at', sort: 'desc' }]);

      expect(result.sort).toBe('created_at');
      expect(result.order).toBe('desc');
    });

    it('handles empty sort model', () => {
      const result = toApiPagination({ page: 0, pageSize: 10 }, []);

      expect(result.sort).toBeUndefined();
      expect(result.order).toBeUndefined();
    });
  });

  describe('initial state', () => {
    it('returns default pagination model with provided pageSize', () => {
      // WHY HIGH VALUE: Tests that defaults are correctly applied
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions({ defaultPageSize: 25 })));

      expect(result.current.paginationModel).toEqual({ page: 0, pageSize: 25 });
    });

    it('returns default sort model from options', () => {
      const { result } = renderHook(() =>
        useServerPaginatedDataGrid(
          createDefaultOptions({
            defaultSort: { field: 'created_at', sort: 'desc' }
          })
        )
      );

      expect(result.current.sortModel).toEqual([{ field: 'created_at', sort: 'desc' }]);
    });

    it('starts with empty search term', () => {
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      expect(result.current.searchTerm).toBe('');
    });

    it('starts with empty data array when no response', () => {
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      expect(result.current.data).toEqual([]);
      expect(result.current.rowCount).toBe(0);
    });
  });

  describe('initial data load', () => {
    it('calls load on mount with default pagination params', () => {
      // WHY HIGH VALUE: Tests that hook fetches data on mount with correct params
      renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      expect(mockLoad).toHaveBeenCalledWith(
        '', // no search term
        expect.objectContaining({
          page: 1,
          limit: 10,
          sort: 'name',
          order: 'asc'
        })
      );
    });

    it('uses custom defaultPageSize in initial load', () => {
      renderHook(() => useServerPaginatedDataGrid(createDefaultOptions({ defaultPageSize: 50 })));

      expect(mockLoad).toHaveBeenCalledWith('', expect.objectContaining({ limit: 50 }));
    });
  });

  describe('data extraction', () => {
    it('extracts data array from response using extractData', async () => {
      // WHY HIGH VALUE: Tests that extractData callback is used correctly
      const mockItems = [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta' }
      ];

      mockUseDataLoader.mockReturnValue({
        data: { items: mockItems, pagination: { total: 2 } },
        error: undefined,
        isLoading: false,
        isReady: true,
        load: mockLoad,
        refresh: mockRefresh,
        clear: vi.fn(),
        setData: vi.fn()
      });

      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      expect(result.current.data).toEqual(mockItems);
    });

    it('extracts total count from response using extractTotal', async () => {
      mockUseDataLoader.mockReturnValue({
        data: { items: [], pagination: { total: 42 } },
        error: undefined,
        isLoading: false,
        isReady: true,
        load: mockLoad,
        refresh: mockRefresh,
        clear: vi.fn(),
        setData: vi.fn()
      });

      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      expect(result.current.rowCount).toBe(42);
    });
  });

  describe('handleSearch', () => {
    it('updates searchTerm immediately', () => {
      // WHY HIGH VALUE: Tests that UI input is responsive (not debounced)
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      act(() => {
        result.current.handleSearch('test query');
      });

      // searchTerm updates immediately (not debounced)
      expect(result.current.searchTerm).toBe('test query');
    });

    it('debounces the API call', () => {
      // WHY HIGH VALUE: Tests debounce behavior - API not called immediately
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions({ debounceMs: 300 })));

      // Clear the initial load call
      mockRefresh.mockClear();

      act(() => {
        result.current.handleSearch('test');
      });

      // API should NOT be called immediately
      expect(mockRefresh).not.toHaveBeenCalled();

      // Advance past debounce delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now API should be called
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('resets to page 1 when searching', () => {
      // WHY HIGH VALUE: Tests critical UX behavior - search should reset pagination
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions({ debounceMs: 300 })));

      // First, change to page 2
      act(() => {
        result.current.handlePaginationChange({ page: 2, pageSize: 10 });
      });

      expect(result.current.paginationModel.page).toBe(2);

      // Clear mocks
      mockRefresh.mockClear();

      // Now search
      act(() => {
        result.current.handleSearch('query');
      });

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Page should reset to 0
      expect(result.current.paginationModel.page).toBe(0);

      // API should be called with page 1
      expect(mockRefresh).toHaveBeenCalledWith('query', expect.objectContaining({ page: 1 }));
    });

    it('passes search term to API after debounce', () => {
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions({ debounceMs: 300 })));

      mockRefresh.mockClear();

      act(() => {
        result.current.handleSearch('alpha');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockRefresh).toHaveBeenCalledWith('alpha', expect.any(Object));
    });
  });

  describe('handlePaginationChange', () => {
    it('updates pagination model immediately', () => {
      // WHY HIGH VALUE: Tests that pagination state updates correctly
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      act(() => {
        result.current.handlePaginationChange({ page: 3, pageSize: 25 });
      });

      expect(result.current.paginationModel).toEqual({ page: 3, pageSize: 25 });
    });

    it('calls API immediately with new pagination (no debounce)', () => {
      // WHY HIGH VALUE: Tests that pagination changes fetch immediately (unlike search)
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      mockRefresh.mockClear();

      act(() => {
        result.current.handlePaginationChange({ page: 2, pageSize: 10 });
      });

      // Should be called immediately, not debounced
      expect(mockRefresh).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          page: 3, // 0-indexed page 2 = API page 3
          limit: 10
        })
      );
    });

    it('preserves current search term when paginating', () => {
      // WHY HIGH VALUE: Tests that search context is maintained across pagination
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions({ debounceMs: 300 })));

      // First, do a search
      act(() => {
        result.current.handleSearch('test');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      mockRefresh.mockClear();

      // Then paginate
      act(() => {
        result.current.handlePaginationChange({ page: 1, pageSize: 10 });
      });

      // Search term should be preserved
      expect(mockRefresh).toHaveBeenCalledWith('test', expect.any(Object));
    });
  });

  describe('handleSortChange', () => {
    it('updates sort model immediately', () => {
      // WHY HIGH VALUE: Tests that sort state updates correctly
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      act(() => {
        result.current.handleSortChange([{ field: 'created_at', sort: 'desc' }]);
      });

      expect(result.current.sortModel).toEqual([{ field: 'created_at', sort: 'desc' }]);
    });

    it('calls API immediately with new sort (no debounce)', () => {
      // WHY HIGH VALUE: Tests that sort changes fetch immediately
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      mockRefresh.mockClear();

      act(() => {
        result.current.handleSortChange([{ field: 'updated_at', sort: 'asc' }]);
      });

      expect(mockRefresh).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          sort: 'updated_at',
          order: 'asc'
        })
      );
    });

    it('preserves current pagination when sorting', () => {
      // WHY HIGH VALUE: Tests that page context is maintained across sort changes
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      // First, go to page 2
      act(() => {
        result.current.handlePaginationChange({ page: 2, pageSize: 10 });
      });

      mockRefresh.mockClear();

      // Then sort
      act(() => {
        result.current.handleSortChange([{ field: 'name', sort: 'desc' }]);
      });

      // Page should be preserved
      expect(mockRefresh).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          page: 3 // page 2 (0-indexed) = API page 3
        })
      );
    });
  });

  describe('refresh', () => {
    it('calls API with current state', () => {
      // WHY HIGH VALUE: Tests manual refresh uses all current params
      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions({ debounceMs: 300 })));

      // Set up some state
      act(() => {
        result.current.handleSearch('query');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      act(() => {
        result.current.handlePaginationChange({ page: 1, pageSize: 20 });
      });

      act(() => {
        result.current.handleSortChange([{ field: 'date', sort: 'desc' }]);
      });

      mockRefresh.mockClear();

      // Call refresh
      act(() => {
        result.current.refresh();
      });

      // Should use all current state
      expect(mockRefresh).toHaveBeenCalledWith(
        'query',
        expect.objectContaining({
          page: 2, // page 1 (0-indexed) = API page 2
          limit: 20,
          sort: 'date',
          order: 'desc'
        })
      );
    });
  });

  describe('isLoading state', () => {
    it('reflects useDataLoader isLoading state', () => {
      mockUseDataLoader.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: true,
        isReady: false,
        load: mockLoad,
        refresh: mockRefresh,
        clear: vi.fn(),
        setData: vi.fn()
      });

      const { result } = renderHook(() => useServerPaginatedDataGrid(createDefaultOptions()));

      expect(result.current.isLoading).toBe(true);
    });
  });
});
