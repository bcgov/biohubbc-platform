import { QueryClient } from '@tanstack/react-query';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { ISubmissionUploadReviewSecurityFeatureResponse } from 'interfaces/useAdminApi.interface';
import { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { useSubmissionUploadFeatureSearch } from './useSubmissionUploadFeatureSearch';

const mocks = vi.hoisted(() => ({
  searchFeatures: vi.fn(),
  countFeatures: vi.fn(),
  setSnackbar: vi.fn()
}));

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    admin: {
      searchSubmissionUploadFeatures: mocks.searchFeatures,
      countSubmissionUploadFeatures: mocks.countFeatures
    }
  })
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar })
}));

const scope = { submissionId: 15, submissionUploadId: 'upload-id' };
const expression = { type: 'expression' as const, operator: 'AND' as const, clauses: [] };

/**
 * Wraps a hook under test in a router at the root URL.
 *
 * @param {PropsWithChildren} props The hook's host.
 * @returns {JSX.Element} The router.
 */
const RootRouter = ({ children }: PropsWithChildren) => <MemoryRouter>{children}</MemoryRouter>;

describe('useSubmissionUploadFeatureSearch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    mocks.searchFeatures.mockResolvedValue({
      features: [],
      pagination: {
        limit: 10,
        sort: 'relevancy_score',
        order: 'desc',
        next_cursor: null,
        previous_cursor: null
      }
    });
    mocks.countFeatures.mockResolvedValue({ total: 42 });
  });

  it('uses the search cursor contract and a separate count request', async () => {
    const { result } = renderHook(() => useSubmissionUploadFeatureSearch(15, 'upload-id', null), {
      wrapper: RootRouter,
      queryClient
    });

    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.totalCount).toBe(42));

    expect(mocks.searchFeatures).toHaveBeenCalledWith(
      15,
      'upload-id',
      null,
      { limit: 10, sort: undefined, order: undefined, cursor: undefined },
      { signal: expect.any(AbortSignal) }
    );
    expect(mocks.countFeatures).toHaveBeenCalledWith(15, 'upload-id', null, {
      signal: expect.any(AbortSignal)
    });
    expect(result.current.cursor).toEqual({
      limit: 10,
      sort: 'relevancy_score',
      order: 'desc',
      next: null,
      previous: null
    });
  });

  it('refreshes the current feature page without recounting when feature results are invalidated', async () => {
    renderHook(() => useSubmissionUploadFeatureSearch(15, 'upload-id', null), { wrapper: RootRouter, queryClient });

    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.countFeatures).toHaveBeenCalledTimes(1));

    await act(() =>
      queryClient.invalidateQueries({ queryKey: submissionUploadQueryKeys.featureSearchResultsAll(scope) })
    );

    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(2));
    expect(mocks.searchFeatures).toHaveBeenLastCalledWith(
      15,
      'upload-id',
      null,
      { limit: 10, sort: undefined, order: undefined, cursor: undefined },
      { signal: expect.any(AbortSignal) }
    );
    expect(mocks.countFeatures).toHaveBeenCalledTimes(1);
  });

  it('recounts and reloads when the whole feature search is invalidated', async () => {
    renderHook(() => useSubmissionUploadFeatureSearch(15, 'upload-id', null), { wrapper: RootRouter, queryClient });
    await waitFor(() => expect(mocks.countFeatures).toHaveBeenCalledTimes(1));

    await act(() => queryClient.invalidateQueries({ queryKey: submissionUploadQueryKeys.featureSearch(scope) }));

    await waitFor(() => expect(mocks.countFeatures).toHaveBeenCalledTimes(2));
    expect(mocks.searchFeatures).toHaveBeenCalledTimes(2);
  });

  it('cancels the old expression requests without reporting them when the expression changes', async () => {
    mocks.searchFeatures.mockImplementationOnce(() => new Promise(() => undefined));
    mocks.countFeatures.mockImplementationOnce(() => new Promise(() => undefined));
    const { result, rerender } = renderHook(
      ({ expressionTree }) => useSubmissionUploadFeatureSearch(15, 'upload-id', expressionTree),
      { wrapper: RootRouter, queryClient, initialProps: { expressionTree: null as typeof expression | null } }
    );
    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledOnce());

    rerender({ expressionTree: expression });

    await waitFor(() => expect(result.current.totalCount).toBe(42));
    expect(mocks.searchFeatures.mock.calls[0][4].signal.aborted).toBe(true);
    expect(mocks.countFeatures.mock.calls[0][3].signal.aborted).toBe(true);
    expect(mocks.searchFeatures).toHaveBeenLastCalledWith(15, 'upload-id', expression, expect.anything(), {
      signal: expect.any(AbortSignal)
    });
    expect(mocks.setSnackbar).not.toHaveBeenCalled();
  });

  it('reports a failed request once', async () => {
    mocks.searchFeatures.mockRejectedValueOnce(new Error('Search failed'));
    const { rerender } = renderHook(() => useSubmissionUploadFeatureSearch(15, 'upload-id', null), {
      wrapper: RootRouter,
      queryClient
    });

    await waitFor(() =>
      expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Search failed' })
    );
    rerender();

    expect(mocks.setSnackbar).toHaveBeenCalledOnce();
  });

  it('keeps the current page visible and preserves cursor, sort, filters, and count while feature results reload', async () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={['/?cursor=CurrentPageToken&limit=25&sort=create_date&order=desc&q=survey']}>
        {children}
      </MemoryRouter>
    );
    const page: ISubmissionUploadReviewSecurityFeatureResponse = {
      features: [
        {
          submission_feature_id: 42,
          feature_type_id: 1,
          feature_type_name: 'survey',
          parent_submission_feature_id: null,
          create_date: '2026-01-01',
          provenance: null
        }
      ],
      pagination: {
        limit: 25,
        sort: 'create_date',
        order: 'desc',
        next_cursor: 'NextPage',
        previous_cursor: 'PreviousPage'
      }
    };
    mocks.searchFeatures.mockResolvedValueOnce(page);
    const { result } = renderHook(() => useSubmissionUploadFeatureSearch(15, 'upload-id', null), {
      wrapper,
      queryClient
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.totalCount).toBe(42));
    const previousCursor = result.current.cursor;
    const previousParams = result.current.searchParams.toString();
    let finishRefresh!: (response: ISubmissionUploadReviewSecurityFeatureResponse) => void;
    mocks.searchFeatures.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        })
    );

    act(() => {
      void queryClient.invalidateQueries({ queryKey: submissionUploadQueryKeys.featureSearchResultsAll(scope) });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.rows).toBe(page.features);
    expect(result.current.cursor).toEqual(previousCursor);
    expect(result.current.totalCount).toBe(42);
    expect(mocks.searchFeatures).toHaveBeenLastCalledWith(
      15,
      'upload-id',
      null,
      { limit: 25, sort: 'create_date', order: 'desc', cursor: 'CurrentPageToken' },
      { signal: expect.any(AbortSignal) }
    );

    await act(async () => finishRefresh({ ...page, features: [{ ...page.features[0], provenance: 'direct' }] }));

    await waitFor(() => expect(result.current.rows[0].provenance).toBe('direct'));
    expect(result.current.rows.map((row) => row.submission_feature_id)).toEqual([42]);
    expect(result.current.cursor).toEqual(previousCursor);
    expect(result.current.searchParams.toString()).toBe(previousParams);
    expect(mocks.countFeatures).toHaveBeenCalledTimes(1);
  });
});
