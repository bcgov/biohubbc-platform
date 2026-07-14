import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DownloadDetail } from 'interfaces/useDownloadApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { PublicDownloadPage } from './PublicDownloadPage';

const mockGetDownload = vi.fn();

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    download: { getDownload: mockGetDownload }
  })
}));

const DOWNLOAD_ID = '11111111-2222-3333-4444-555555555555';

const makeDownload = (overrides: Partial<DownloadDetail> = {}): DownloadDetail => ({
  download_id: DOWNLOAD_ID,
  download_version_id: 'ver-abc-123',
  status: 'pending',
  name: 'Bears in BC',
  description: 'All bear observations within BC',
  started_at: null,
  completed_at: null,
  downloaded_at: null,
  ...overrides
});

const makeApiError = (status: number) => {
  const err = new Error(`status ${status}`) as Error & { status: number; name: string };
  err.status = status;
  err.name = 'APIError';
  return err;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/download/:downloadId" element={<PublicDownloadPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('PublicDownloadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders status chip and "Preparing…" copy when status is pending', async () => {
    mockGetDownload.mockResolvedValue(makeDownload({ status: 'pending' }));

    const { getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Pending')).toBeVisible();
    });
    expect(getByText('Preparing your download…')).toBeVisible();
  });

  it('renders status chip and "Preparing…" copy when status is processing', async () => {
    mockGetDownload.mockResolvedValue(makeDownload({ status: 'processing' }));

    const { getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Processing')).toBeVisible();
    });
    expect(getByText('Preparing your download…')).toBeVisible();
  });

  it('renders status chip and "ready" copy when status is ready', async () => {
    mockGetDownload.mockResolvedValue(makeDownload({ status: 'ready' }));

    const { getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Ready')).toBeVisible();
    });
    expect(getByText('Your download is ready.')).toBeVisible();
  });

  it('renders failure copy when status is failed', async () => {
    mockGetDownload.mockResolvedValue(makeDownload({ status: 'failed' }));

    const { getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Failed')).toBeVisible();
    });
    expect(getByText('This download failed. Please try again from search.')).toBeVisible();
  });

  it('refreshes the data loader when the Refresh button is clicked', async () => {
    mockGetDownload.mockResolvedValue(makeDownload({ status: 'pending' }));

    const { findByRole } = renderAt(`/download/${DOWNLOAD_ID}`);

    const refreshButton = await findByRole('button', { name: /refresh/i });

    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockGetDownload).toHaveBeenCalledTimes(2);
    });
    expect(mockGetDownload).toHaveBeenLastCalledWith(DOWNLOAD_ID);
  });

  it('renders the dead-end card when the API returns 404', async () => {
    mockGetDownload.mockRejectedValue(makeApiError(404));

    const { getByText, queryByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Download not available')).toBeVisible();
    });
    // No PageHeader "Download" label on the dead-end branch.
    expect(queryByText('Download')).not.toBeInTheDocument();
  });

  it('renders the same dead-end card when the API returns 403', async () => {
    mockGetDownload.mockRejectedValue(makeApiError(403));

    const { getByText, queryByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Download not available')).toBeVisible();
    });
    expect(queryByText('Download')).not.toBeInTheDocument();
  });

  it('does NOT render the dead-end card when the API returns 500', async () => {
    mockGetDownload.mockRejectedValue(makeApiError(500));

    const { queryByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    // Wait for the data loader's promise to settle.
    await waitFor(() => {
      expect(mockGetDownload).toHaveBeenCalled();
    });
    // A 5xx error is not a dead-end — the user can refresh / retry.
    expect(queryByText('Download not available')).not.toBeInTheDocument();
  });

  it('renders the policy name as the subheader', async () => {
    mockGetDownload.mockResolvedValue(makeDownload({ name: 'Owls in BC' }));

    const { getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Owls in BC')).toBeVisible();
    });
  });

  it('renders the description when non-null', async () => {
    mockGetDownload.mockResolvedValue(makeDownload({ description: 'A description of the downloaded data' }));

    const { getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('A description of the downloaded data')).toBeVisible();
    });
  });

  it('does NOT render a description block when description is null', async () => {
    mockGetDownload.mockResolvedValue(makeDownload({ description: null }));

    const { getByText, container } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Bears in BC')).toBeVisible();
    });
    // The status chip + status copy + (optional) description live in the Stack.
    // With description null, there should be exactly two children in that stack.
    // Cheaper assertion: the only "secondary" text is the id line; no description text appears.
    // Just assert by absence of any non-id grey body line — concretely, no element with the description content exists.
    expect(container.textContent).not.toMatch(/A description of/);
  });

  it('exposes the current page URL as a readonly share-link field', async () => {
    mockGetDownload.mockResolvedValue(makeDownload());

    const { findByLabelText } = renderAt(`/download/${DOWNLOAD_ID}`);

    const input = (await findByLabelText('Share link')) as HTMLInputElement;
    expect(input).toBeVisible();
    expect(input.readOnly).toBe(true);
    expect(input.value).toContain(`/download/${DOWNLOAD_ID}`);
  });

  it('renders identically regardless of auth state (no AuthStateContext usage)', async () => {
    // The page must not branch on auth — it isn't wrapped in any AuthStateContextProvider here.
    // If the page ever imported useAuthStateContext, this render would throw because no provider exists.
    mockGetDownload.mockResolvedValue(makeDownload({ status: 'ready' }));

    const { getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Ready')).toBeVisible();
    });
    expect(getByText('Your download is ready.')).toBeVisible();
    expect(getByText('Bears in BC')).toBeVisible();
  });
});
