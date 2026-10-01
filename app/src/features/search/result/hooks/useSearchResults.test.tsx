import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { URL_PARAMS } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useSearchQueryParams } from 'hooks/useSearchQuery';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { SearchFeatureResponse } from 'interfaces/useSearchApi.interface';
import { useMemo } from 'react';
import { Mock, vi } from 'vitest';
import { useSearchResults } from './useSearchResults';

vi.mock('hooks/useApi');
vi.mock('hooks/useContext');
vi.mock('hooks/useSearchQuery', () => ({
  TypedURLSearchParams: URLSearchParams,
  useSearchQueryParams: vi.fn()
}));

const mockSearchFeatures = vi.fn();

/**
 * Lets settled requests reach the hook: the query client delivers updates on a zero-delay timer.
 *
 * @returns {Promise<void>} Resolves once pending query notifications have run.
 */
const flushQueryUpdates = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const mockCountFeatures = vi.fn();

describe('useSearchResults', () => {
  const expectAbortOptions = expect.objectContaining({ signal: expect.any(Object) });
  const defaultSearchFeatureResponse: SearchFeatureResponse = {
    features: [],
    properties: [],
    has_inaccessible_secured_features: false,
    pagination: {
      limit: 25,
      sort: 'relevancy_score',
      order: 'desc',
      next_cursor: null,
      previous_cursor: null
    }
  };
  const expressionTree: ExpressionTreeExpression = {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 10,
        blueprint_feature_type_property_id: null,
        operator: 'ILike',
        value: 'salmon'
      }
    ]
  };

  beforeEach(() => {
    mockSearchFeatures.mockResolvedValue(defaultSearchFeatureResponse);
    mockCountFeatures.mockResolvedValue({ total: 0 });

    (useApi as Mock).mockReturnValue({
      search: {
        searchFeatures: mockSearchFeatures,
        countFeatures: mockCountFeatures
      }
    });

    (useDialogContext as Mock).mockReturnValue({
      setSnackbar: vi.fn()
    });

    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: new URLSearchParams('page=1&limit=25&sort=create_date&order=asc'),
      setSearchParams: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses API cursors while the separate count is pending', async () => {
    mockCountFeatures.mockImplementation(() => new Promise(() => {}));
    mockSearchFeatures.mockResolvedValue({
      ...defaultSearchFeatureResponse,
      pagination: { ...defaultSearchFeatureResponse.pagination, next_cursor: 'next', previous_cursor: 'previous' }
    });
    const { result } = renderHook(() => useSearchResults('survey'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalCount).toBeUndefined();
    expect(result.current.cursor.next).toBe('next');
    expect(result.current.cursor.previous).toBe('previous');
  });

  it('restores a copied cursor URL without page-number metadata', async () => {
    const setSearchParams = vi.fn();
    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: new URLSearchParams('limit=50&cursor=CaseSensitive_Cursor'),
      setSearchParams
    });
    const { result } = renderHook(() => useSearchResults('survey'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockSearchFeatures.mock.lastCall?.[2]).toEqual(
      expect.objectContaining({ limit: 50, cursor: 'CaseSensitive_Cursor' })
    );
    expect(setSearchParams).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores legacy page numbers and removes them on cursor navigation', async () => {
    const setSearchParams = vi.fn();
    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: new URLSearchParams('page=122&limit=50'),
      setSearchParams
    });
    const { result } = renderHook(() => useSearchResults('survey'));
    await act(async () => {
      await flushQueryUpdates();
    });
    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    act(() => result.current.setSearchParams({ cursor: 'Next_Cursor' }));
    expect(setSearchParams.mock.lastCall?.[0].toString()).toBe('limit=50&cursor=Next_Cursor');
  });

  it('sends the applied expression tree to the feature search endpoint hook', async () => {
    renderHook(() => useSearchResults('species_observation', true, expressionTree));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledWith(
        'species_observation',
        expressionTree,
        {
          limit: 25,
          sort: 'create_date',
          order: 'asc'
        },
        expectAbortOptions
      );
    });

    expect(mockCountFeatures).toHaveBeenCalledWith('species_observation', expressionTree, expectAbortOptions);
    expect(mockCountFeatures.mock.calls[0][2].signal).not.toBe(mockSearchFeatures.mock.calls[0][3].signal);
  });

  it('keeps the independently loaded count when the current result page is empty', async () => {
    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: new URLSearchParams('page=1&limit=25'),
      setSearchParams: vi.fn()
    });

    let resolveResults: (response: SearchFeatureResponse) => void;
    let resolveCount: (response: { total: number }) => void;
    mockSearchFeatures.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResults = resolve;
        })
    );
    mockCountFeatures.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCount = resolve;
        })
    );

    const { result } = renderHook(() => useSearchResults('species_observation', true, expressionTree));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledOnce();
      expect(mockCountFeatures).toHaveBeenCalledOnce();
    });

    await act(async () => {
      resolveCount!({ total: 50_000_000 });
      await flushQueryUpdates();
    });

    expect(result.current.totalCount).toBe(50_000_000);

    await act(async () => {
      resolveResults!(defaultSearchFeatureResponse);
      await flushQueryUpdates();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.totalCount).toBe(50_000_000);
  });

  it('clears pagination state immediately when the feature type changes', async () => {
    mockSearchFeatures.mockResolvedValue({
      ...defaultSearchFeatureResponse,
      pagination: { next_cursor: 'next-species', previous_cursor: 'previous-species' }
    });
    mockCountFeatures.mockResolvedValue({ total: 50_000_000 });

    const { result, rerender } = renderHook(({ featureTypeName }) => useSearchResults(featureTypeName, true, null), {
      initialProps: { featureTypeName: 'species_observation' }
    });

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(result.current.totalCount).toBe(50_000_000);
    expect(result.current.cursor.next).toBe('next-species');
    expect(result.current.cursor.previous).toBe('previous-species');

    rerender({ featureTypeName: 'habitat_feature' });

    expect(result.current.totalCount).toBeUndefined();
    expect(result.current.cursor.next).toBeNull();
    expect(result.current.cursor.previous).toBeNull();
    await act(async () => {
      await flushQueryUpdates();
    });
  });

  it('sends null expression with pagination when filters are cleared', async () => {
    renderHook(() => useSearchResults('species_observation', true, null));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledWith(
        'species_observation',
        null,
        {
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
      searchParams: new URLSearchParams('page=1&limit=25'),
      setSearchParams: vi.fn()
    });

    renderHook(() => useSearchResults('species_observation', true, null));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledWith(
        'species_observation',
        null,
        {
          limit: 25,
          sort: undefined,
          order: undefined
        },
        expectAbortOptions
      );
    });
  });

  it('does not issue a redundant immediate refresh after setter-driven URL updates', async () => {
    mockCountFeatures.mockResolvedValue({ total: 50 });

    let currentSearchParams = new URLSearchParams('page=1&limit=25');
    const setSearchParams = vi.fn((nextSearchParams: URLSearchParams) => {
      currentSearchParams = nextSearchParams;
    });

    (useSearchQueryParams as Mock).mockImplementation(() => ({
      searchParams: currentSearchParams,
      setSearchParams
    }));

    const { result, rerender } = renderHook(() => useSearchResults('species_observation', true, null));

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setSearchParams({ [URL_PARAMS.CURSOR]: 'next-token' });
    });
    rerender();

    expect(mockSearchFeatures).toHaveBeenCalledTimes(2);

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(2);
    expect(mockCountFeatures).toHaveBeenCalledTimes(1);
    expect(mockSearchFeatures).toHaveBeenLastCalledWith(
      'species_observation',
      null,
      {
        limit: 25,
        sort: undefined,
        order: undefined,
        cursor: 'next-token'
      },
      expectAbortOptions
    );
  });

  it('uses updated limit in the next request after page size changes', async () => {
    let currentSearchParams = new URLSearchParams('page=1&limit=10');
    const setSearchParams = vi.fn((nextSearchParams: URLSearchParams) => {
      currentSearchParams = nextSearchParams;
    });

    (useSearchQueryParams as Mock).mockImplementation(() => ({
      searchParams: currentSearchParams,
      setSearchParams
    }));

    const { result, rerender } = renderHook(() => useSearchResults('species_observation', true, null));

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    mockSearchFeatures.mockClear();

    act(() => {
      result.current.setSearchParams({ [URL_PARAMS.LIMIT]: '50' });
    });
    rerender();

    expect(setSearchParams.mock.calls[0][0].toString()).toBe('limit=50');

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    expect(mockSearchFeatures).toHaveBeenLastCalledWith(
      'species_observation',
      null,
      {
        limit: 50,
        sort: undefined,
        order: undefined
      },
      expectAbortOptions
    );
  });

  it('starts page requests immediately and stays loading until they finish', async () => {
    mockCountFeatures.mockResolvedValue({ total: 50 });

    let currentSearchParams = new URLSearchParams('page=1&limit=25');
    const setSearchParams = vi.fn((nextSearchParams: URLSearchParams) => {
      currentSearchParams = nextSearchParams;
    });

    (useSearchQueryParams as Mock).mockImplementation(() => ({
      searchParams: currentSearchParams,
      setSearchParams
    }));

    const { result, rerender } = renderHook(() => useSearchResults('species_observation', true, null));

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(result.current.isLoading).toBe(false);
    mockSearchFeatures.mockClear();

    act(() => {
      result.current.setSearchParams({ [URL_PARAMS.CURSOR]: 'next-token' });
    });
    rerender();

    expect(result.current.isLoading).toBe(true);
    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
  });

  it('stops loading after an initial error and allows retry', async () => {
    mockSearchFeatures
      .mockRejectedValueOnce(new Error('Search failed'))
      .mockResolvedValueOnce(defaultSearchFeatureResponse);

    const { result } = renderHook(() => useSearchResults('species_observation', true, null));

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect((useDialogContext as Mock).mock.results[0].value.setSnackbar).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Search failed'
    });
    expect(result.current.totalCount).toBe(0);

    act(() => result.current.reload());

    await waitFor(() => expect(mockSearchFeatures).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalCount).toBe(0);
  });

  it('starts one immediate request when the applied expression changes', async () => {
    const updatedExpressionTree: ExpressionTreeExpression = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 11,
          blueprint_feature_type_property_id: null,
          operator: 'ILike',
          value: 'trout'
        }
      ]
    };

    const { rerender } = renderHook(
      ({ appliedExpression }) => useSearchResults('species_observation', true, appliedExpression),
      {
        initialProps: { appliedExpression: null as ExpressionTreeExpression | null }
      }
    );

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    mockSearchFeatures.mockClear();

    await act(async () => {
      rerender({ appliedExpression: updatedExpressionTree });
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    expect(mockSearchFeatures).toHaveBeenLastCalledWith(
      'species_observation',
      updatedExpressionTree,
      {
        limit: 25,
        sort: 'create_date',
        order: 'asc'
      },
      expectAbortOptions
    );
  });

  it('keeps loading true when switching feature types while a request is in flight', async () => {
    mockSearchFeatures.mockImplementation(
      (_featureType, _expressionTree, _pagination, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('canceled');
            error.name = 'CanceledError';
            reject(error);
          });
        })
    );

    const { result, rerender } = renderHook(({ featureTypeName }) => useSearchResults(featureTypeName, true, null), {
      initialProps: { featureTypeName: 'species_observation' }
    });

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      rerender({ featureTypeName: 'telemetry' });
      await flushQueryUpdates();
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockSearchFeatures).toHaveBeenCalledTimes(2);

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(2);
    expect(mockSearchFeatures).toHaveBeenLastCalledWith(
      'telemetry',
      null,
      {
        limit: 25,
        sort: 'create_date',
        order: 'asc'
      },
      expectAbortOptions
    );
  });

  it('reuses a memoized submission scope across renders and refreshes when its ID changes', async () => {
    const { result, rerender } = renderHook(
      ({ submissionId }) => {
        const submissionIds = useMemo(() => [submissionId], [submissionId]);
        return useSearchResults('species_observation', true, null, submissionIds);
      },
      { initialProps: { submissionId: 42 } }
    );

    await act(async () => {
      await flushQueryUpdates();
    });
    rerender({ submissionId: 42 });
    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(mockCountFeatures).toHaveBeenCalledTimes(1);

    rerender({ submissionId: 43 });
    await act(async () => {
      await flushQueryUpdates();
    });
    expect(mockSearchFeatures).toHaveBeenCalledTimes(2);
    expect(mockCountFeatures).toHaveBeenCalledTimes(2);
    expect(mockCountFeatures).toHaveBeenLastCalledWith(
      'species_observation',
      null,
      expect.objectContaining({ submissionIds: [43] })
    );
    expect(mockSearchFeatures).toHaveBeenLastCalledWith(
      'species_observation',
      null,
      expect.any(Object),
      expect.objectContaining({ submissionIds: [43] })
    );
  });

  it('searches again with every input unchanged when reloaded', async () => {
    const { result } = renderHook(() => useSearchResults('species_observation', true, null));

    await waitFor(() => expect(mockSearchFeatures).toHaveBeenCalledTimes(1));

    act(() => result.current.reload());

    await waitFor(() => expect(mockSearchFeatures).toHaveBeenCalledTimes(2));
    expect(mockCountFeatures).toHaveBeenCalledTimes(2);
    expect(mockSearchFeatures).toHaveBeenLastCalledWith(
      'species_observation',
      null,
      {
        limit: 25,
        sort: 'create_date',
        order: 'asc'
      },
      expectAbortOptions
    );
  });

  it('aborts a reload in flight and immediately starts the next one when reloaded again', async () => {
    mockSearchFeatures
      .mockResolvedValueOnce(defaultSearchFeatureResponse)
      .mockImplementation(() => new Promise(() => undefined));

    const { result } = renderHook(() => useSearchResults('species_observation', true, expressionTree));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.reload());
    await waitFor(() => expect(mockSearchFeatures).toHaveBeenCalledTimes(2));
    const reloadSignal = mockSearchFeatures.mock.calls[1][3].signal as AbortSignal;
    act(() => result.current.reload());

    await waitFor(() => expect(mockSearchFeatures).toHaveBeenCalledTimes(3));
    expect(reloadSignal.aborted).toBe(true);
    expect((mockSearchFeatures.mock.calls[2][3].signal as AbortSignal).aborted).toBe(false);
  });

  it('joins the first load rather than restarting it when reloaded before any results arrive', async () => {
    mockSearchFeatures.mockImplementation(() => new Promise(() => undefined));

    const { result } = renderHook(() => useSearchResults('species_observation', true, expressionTree));
    await waitFor(() => expect(mockSearchFeatures).toHaveBeenCalledTimes(1));

    act(() => result.current.reload());
    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    expect((mockSearchFeatures.mock.calls[0][3].signal as AbortSignal).aborted).toBe(false);
  });

  it('aborts an active request and immediately starts the next request when sort changes', async () => {
    const setSearchParams = vi.fn();
    const initialSearchParams = new URLSearchParams('page=1&limit=25&sort=create_date&order=asc');
    const sortedSearchParams = new URLSearchParams('page=1&limit=25&sort=relevancy_score&order=desc');

    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: initialSearchParams,
      setSearchParams
    });
    mockSearchFeatures.mockImplementation(
      () =>
        new Promise(() => {
          // Keep the request active until the hook aborts it.
        })
    );

    const { rerender } = renderHook(() => useSearchResults('species_observation', true, expressionTree));

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).toHaveBeenCalledTimes(1);
    const firstSignal = mockSearchFeatures.mock.calls[0][3].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: sortedSearchParams,
      setSearchParams
    });

    await act(async () => {
      rerender();
      await flushQueryUpdates();
    });

    expect(firstSignal.aborted).toBe(true);
    expect(mockSearchFeatures).toHaveBeenCalledTimes(2);
    expect(mockSearchFeatures).toHaveBeenLastCalledWith(
      'species_observation',
      expressionTree,
      {
        limit: 25,
        sort: 'relevancy_score',
        order: 'desc'
      },
      expectAbortOptions
    );
  });
  it.each(['resolve', 'reject'])('ignores a reload that %ss after it was superseded', async (completion) => {
    let resolveResults!: (response: SearchFeatureResponse) => void;
    let rejectResults!: (error: Error) => void;
    let resolveCount!: (response: { total: number }) => void;
    let rejectCount!: (error: Error) => void;
    mockSearchFeatures
      .mockResolvedValueOnce(defaultSearchFeatureResponse)
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            resolveResults = resolve;
            rejectResults = reject;
          })
      )
      .mockImplementationOnce(() => new Promise(() => {}));
    mockCountFeatures
      .mockResolvedValueOnce({ total: 10 })
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            resolveCount = resolve;
            rejectCount = reject;
          })
      )
      .mockResolvedValueOnce({ total: 50 });
    const { result, unmount } = renderHook(() => useSearchResults('survey', true, null));
    await waitFor(() => expect(result.current.totalCount).toBe(10));

    act(() => result.current.reload());
    await waitFor(() => expect(mockCountFeatures).toHaveBeenCalledTimes(2));
    const staleResultsSignal = mockSearchFeatures.mock.calls[1][3].signal;
    const staleCountSignal = mockCountFeatures.mock.calls[1][2].signal;
    act(() => result.current.reload());
    await waitFor(() => expect(mockCountFeatures).toHaveBeenCalledTimes(3));

    expect(staleResultsSignal.aborted).toBe(true);
    expect(staleCountSignal.aborted).toBe(true);
    await act(async () => {
      if (completion === 'resolve') {
        resolveResults({
          ...defaultSearchFeatureResponse,
          features: [{ submission_feature_id: 99 }]
        } as SearchFeatureResponse);
        resolveCount({ total: 999 });
      } else {
        rejectResults(new Error('Old search failed'));
        rejectCount(new Error('Old count failed'));
      }
      await flushQueryUpdates();
    });
    await waitFor(() => expect(result.current.totalCount).toBe(50));
    expect(result.current.rows).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect((useDialogContext as Mock).mock.results[0].value.setSnackbar).not.toHaveBeenCalled();
    unmount();
    expect(mockSearchFeatures.mock.calls[2][3].signal.aborted).toBe(true);
  });

  it('issues no requests while search is disabled', async () => {
    const { result } = renderHook(() => useSearchResults('survey', false));

    await act(async () => {
      await flushQueryUpdates();
    });

    expect(mockSearchFeatures).not.toHaveBeenCalled();
    expect(mockCountFeatures).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
  });
});
