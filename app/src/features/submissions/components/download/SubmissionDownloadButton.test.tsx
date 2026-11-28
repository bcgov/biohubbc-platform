import { fireEvent, render, waitFor } from 'test-helpers/test-utils';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import { Mock, vi } from 'vitest';
import { SubmissionDownloadButton } from './SubmissionDownloadButton';

vi.mock('hooks/useApi');
vi.mock('hooks/useContext');
vi.mock('hooks/useAuthStateContext');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockCreateSubmissionDownload = vi.fn();
const mockSetSnackbar = vi.fn();

describe('SubmissionDownloadButton', () => {
  beforeEach(() => {
    mockCreateSubmissionDownload.mockResolvedValue({
      download_id: 'download-uuid',
      download_url: 'http://localhost/api/download/download-uuid'
    });
    (useApi as Mock).mockReturnValue({ download: { createSubmissionDownload: mockCreateSubmissionDownload } });
    (useAuthStateContext as Mock).mockReturnValue({ auth: { isAuthenticated: true } });
    (useDialogContext as Mock).mockReturnValue({ setSnackbar: mockSetSnackbar });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a download of the submission and opens it in the portal for a signed-in user', async () => {
    const { getByTestId } = render(<SubmissionDownloadButton submissionId={14} />);

    fireEvent.click(getByTestId('submission-download-button'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/portal/download/download-uuid'));
    expect(mockCreateSubmissionDownload).toHaveBeenCalledExactlyOnceWith(14);
    expect(mockSetSnackbar).not.toHaveBeenCalled();
  });

  it('opens an anonymous download on the public download page', async () => {
    (useAuthStateContext as Mock).mockReturnValue({ auth: { isAuthenticated: false } });
    const { getByTestId } = render(<SubmissionDownloadButton submissionId={14} />);

    fireEvent.click(getByTestId('submission-download-button'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/download/download-uuid'));
  });

  it('shows the error and stays on the page when the download cannot be created', async () => {
    mockCreateSubmissionDownload.mockRejectedValue(new Error('Failed to get submission record'));
    const { getByTestId } = render(<SubmissionDownloadButton submissionId={14} />);

    fireEvent.click(getByTestId('submission-download-button'));

    await waitFor(() =>
      expect(mockSetSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Failed to get submission record' })
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('creates one download when clicked again while the first is still being created', async () => {
    mockCreateSubmissionDownload.mockReturnValue(new Promise(() => undefined));
    const { getByTestId } = render(<SubmissionDownloadButton submissionId={14} />);
    const button = getByTestId('submission-download-button');

    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);

    expect(mockCreateSubmissionDownload).toHaveBeenCalledTimes(1);
  });
});
