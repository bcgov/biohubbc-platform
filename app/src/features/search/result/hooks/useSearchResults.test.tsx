import { act, renderHook, waitFor } from '@testing-library/react';
import { URL_PARAMS } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useSearchQueryParams } from 'hooks/useSearchQuery';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { Mock, vi } from 'vitest';
import { useSearchResults } from './useSearchResults';

vi.mock('hooks/useApi');
vi.mock('hooks/useContext');
vi.mock('hooks/useSearchQuery', () => ({
  TypedURLSearchParams: URLSearchParams,
  useSearchQueryParams: vi.fn()
}));

const mockSearchFeatures = vi.fn();

describe('useSearchResults', () => {
  const expectAbortOptions = expect.objectContaining({ signal: expect.any(Object) });
  const expressionTree: ExpressionTreeExpression = {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 10,
        feature_type_property_id: null,
        operator: 'ILike',
        value: 'salmon'
      }
    ]
  };

  beforeEach(() => {
    mockSearchFeatures.mockResolvedValue({
      features: [],
      properties: [],
      pagination: {
        total: 0,
        per_page: 25,
        current_page: 2,
        last_page: 1,
        sort: 'create_date',
        order: 'asc'
      }
    });

    (useApi as Mock).mockReturnValue({
      search: {
        searchFeatures: mockSearchFeatures
      }
    });

    (useDialogContext as Mock).mockReturnValue({
      setSnackbar: vi.fn()
    });

    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: new URLSearchParams('page=2&limit=25&sort=create_date&order=asc'),
      setSearchParams: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sends the applied expression tree to the feature search endpoint hook', async () => {
    renderHook(() => useSearchResults('species_observation', true, expressionTree));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledWith(
        'species_observation',
        expressionTree,
        {
          page: 2,
          limit: 25,
          sort: 'create_date',
          order: 'asc'
        },
        expectAbortOptions
      );
    });
  });

  it('sends null expression with pagination when filters are cleared', async () => {
    renderHook(() => useSearchResults('species_observation', true, null));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledWith(
        'species_observation',
        null,
        {
          page: 2,
          limit: 25,
          sort: 'create_date',
          order: 'asc'
        },
        expectAbortOptions
      );
    });
  });

  it('uses pagination without explicit sort when no expression filters are applied', async () => {
    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: new URLSearchParams('page=3&limit=25'),
      setSearchParams: vi.fn()
    });

    renderHook(() => useSearchResults('species_observation', true, null));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledWith(
        'species_observation',
        null,
        {
          page: 3,
          limit: 25,
          sort: undefined,
          order: undefined
        },
        expectAbortOptions
      );
    });
  });

  it('does not issue a redundant immediate refresh after setter-driven URL updates', async () => {
    vi.useFakeTimers();

    let currentSearchParams = new URLSearchParams('page=2&limit=25');
    const setSearchParams = vi.fn((nextSearchParams: URLSearchParams) => {
      currentSearchParams = nextSearchParams;
    });

    (useSearchQueryParams as Mock).mockImplementation(() => ({
      searchParams: currentSearchParams,
      setSearchParams
    }));

    const { result, rerender } = renderHook(() => useSearchResults('species_observation', true, null));

    expect(mockSearchFeatures).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setSearchParams({ [URL_PARAMS.PAGE]: '3' });
    });
    rerender();

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(2);
    expect(mockSearchFeatures).toHaveBeenLastCalledWith(
      'species_observation',
      null,
      {
        page: 3,
        limit: 25,
        sort: undefined,
        order: undefined
      },
      expectAbortOptions
    );
  });

  it('refreshes with a null expression when the explicit refresh key changes', async () => {
    vi.useFakeTimers();

    const { rerender } = renderHook(
      ({ refreshKey }) => useSearchResults('species_observation', true, null, refreshKey),
      {
        initialProps: { refreshKey: 0 }
      }
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ refreshKey: 1 });
      await Promise.resolve();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(2);
    expect(mockSearchFeatures).toHaveBeenLastCalledWith(
      'species_observation',
      null,
      {
        page: 2,
        limit: 25,
        sort: 'create_date',
        order: 'asc'
      },
      expectAbortOptions
    );
  });

  it('aborts an active request and immediately starts the next request when apply refreshes again', async () => {
    vi.useFakeTimers();

    mockSearchFeatures.mockImplementation(
      () =>
        new Promise(() => {
          // Keep the request active until the hook aborts it.
        })
    );

    const { rerender } = renderHook(
      ({ refreshKey }) => useSearchResults('species_observation', true, expressionTree, refreshKey),
      {
        initialProps: { refreshKey: 0 }
      }
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    const firstSignal = mockSearchFeatures.mock.calls[0][3].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    await act(async () => {
      rerender({ refreshKey: 1 });
      await Promise.resolve();
    });

    expect(firstSignal.aborted).toBe(true);
    expect(mockSearchFeatures).toHaveBeenCalledTimes(2);
    const secondSignal = mockSearchFeatures.mock.calls[1][3].signal as AbortSignal;
    expect(secondSignal.aborted).toBe(false);
  });
});
