import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { TicketSubmissionUploadResponse } from 'interfaces/useTicketsApi.interface';
import { Mock } from 'vitest';
import { useTicketTimelineUploadActions } from './useTicketTimelineUploadActions';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn()
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => mocks.navigate
}));

vi.mock('hooks/useApi', () => ({
  useApi: vi.fn()
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: vi.fn(),
  useTicketContext: vi.fn()
}));

const submissionUploadId = '22222222-2222-4222-8222-222222222222';
const reviewId = '33333333-3333-4333-8333-333333333333';
const reviewDetails = { name: 'Security review', description: 'Check access rules' };

const upload: TicketSubmissionUploadResponse = {
  submission_upload_id: submissionUploadId,
  submission_id: 17,
  upload_id: '44444444-4444-4444-8444-444444444444',
  create_date: '2026-09-04T12:00:00.000Z',
  submission_name: 'Test submission',
  submission_description: null,
  submission_comment: null,
  submitted_by_identifier: 'admin@example.com',
  upload_status: 'indexed',
  review_status: 'submitted',
  validation: null,
  reviews: {
    security: [],
    validation: []
  }
};

describe('useTicketTimelineUploadActions', () => {
  const insertSubmissionUploadReview = vi.fn();
  const setSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useApi as Mock).mockReturnValue({ tickets: { insertSubmissionUploadReview } });
    (useDialogContext as Mock).mockReturnValue({
      setSnackbar,
      setYesNoDialog: vi.fn()
    });
    (useTicketContext as Mock).mockReturnValue({
      ticketDataLoader: {
        data: null,
        setData: vi.fn()
      }
    });
  });

  it('creates an in-progress security review and navigates to the returned review', async () => {
    let resolveRequest: (value: unknown) => void = vi.fn();
    insertSubmissionUploadReview.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    const { result } = renderHook(() => useTicketTimelineUploadActions());

    let request: Promise<void> = Promise.resolve();
    act(() => {
      request = result.current.handleCreateSubmissionUploadReview(upload, 'security', reviewDetails);
    });

    expect(insertSubmissionUploadReview).toHaveBeenCalledTimes(1);
    expect(insertSubmissionUploadReview).toHaveBeenCalledWith(17, submissionUploadId, {
      ...reviewDetails,
      scope: 'security',
      status: 'in_progress'
    });
    expect(mocks.navigate).not.toHaveBeenCalled();

    resolveRequest({
      submission_upload_review_id: reviewId,
      submission_upload_id: submissionUploadId,
      ...reviewDetails,
      scope: 'security',
      status: 'in_progress',
      requested_by: 7
    });
    await act(async () => request);

    expect(mocks.navigate).toHaveBeenCalledWith(
      `/admin/submission/17/upload/${submissionUploadId}/review/security/${reviewId}`
    );
  });

  it('reports a validation review failure without navigating and allows a retry', async () => {
    insertSubmissionUploadReview.mockRejectedValueOnce(new Error('Unable to create review'));
    const { result } = renderHook(() => useTicketTimelineUploadActions());

    await act(async () => result.current.handleCreateSubmissionUploadReview(upload, 'validation', reviewDetails));

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(setSnackbar).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Unable to create review'
    });
    insertSubmissionUploadReview.mockResolvedValueOnce({
      submission_upload_review_id: reviewId,
      submission_upload_id: submissionUploadId,
      ...reviewDetails,
      scope: 'validation',
      status: 'in_progress',
      requested_by: 7
    });
    await act(async () => result.current.handleCreateSubmissionUploadReview(upload, 'validation', reviewDetails));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        `/admin/submission/17/upload/${submissionUploadId}/review/validation/${reviewId}`
      )
    );
    expect(insertSubmissionUploadReview).toHaveBeenCalledTimes(2);
  });

  it('opens an existing review without creating another review', () => {
    const { result } = renderHook(() => useTicketTimelineUploadActions());

    act(() => result.current.handleOpenSubmissionUploadReview(upload, 'validation', reviewId));

    expect(mocks.navigate).toHaveBeenCalledWith(
      `/admin/submission/17/upload/${submissionUploadId}/review/validation/${reviewId}`
    );
    expect(insertSubmissionUploadReview).not.toHaveBeenCalled();
  });
});
