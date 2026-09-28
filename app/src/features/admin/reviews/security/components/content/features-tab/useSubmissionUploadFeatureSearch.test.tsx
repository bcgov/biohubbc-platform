import { act, renderHook, waitFor } from '@testing-library/react';
import { ISubmissionUploadReviewSecurityFeatureResponse } from 'interfaces/useAdminApi.interface';
import { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router';
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

describe('useSubmissionUploadFeatureSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const wrapper = ({ children }: PropsWithChildren) => <MemoryRouter>{children}</MemoryRouter>;
    const { result } = renderHook(() => useSubmissionUploadFeatureSearch(15, 'upload-id', null, 0, 0), { wrapper });

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

  it('refreshes the current feature page without recounting when security changes', async () => {
    const wrapper = ({ children }: PropsWithChildren) => <MemoryRouter>{children}</MemoryRouter>;
    const { rerender } = renderHook(
      ({ refreshRevision }) => useSubmissionUploadFeatureSearch(15, 'upload-id', null, 0, refreshRevision),
      { wrapper, initialProps: { refreshRevision: 0 } }
    );

    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.countFeatures).toHaveBeenCalledTimes(1));

    rerender({ refreshRevision: 1 });

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
  it('keeps the current page visible and preserves cursor, sort, filters, and count during a security refresh', async () => {
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
    const { result, rerender } = renderHook(
      ({ refreshRevision }) => useSubmissionUploadFeatureSearch(15, 'upload-id', null, 0, refreshRevision),
      { wrapper, initialProps: { refreshRevision: 0 } }
    );
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

    rerender({ refreshRevision: 1 });

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

    expect(result.current.rows[0].provenance).toBe('direct');
    expect(result.current.rows.map((row) => row.submission_feature_id)).toEqual([42]);
    expect(result.current.cursor).toEqual(previousCursor);
    expect(result.current.searchParams.toString()).toBe(previousParams);
    expect(mocks.countFeatures).toHaveBeenCalledTimes(1);
  });
});
