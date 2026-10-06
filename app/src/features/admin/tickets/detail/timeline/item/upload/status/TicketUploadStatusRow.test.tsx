import { mdiCheck, mdiClose, mdiProgressClock } from '@mdi/js';
import userEvent from '@testing-library/user-event';
import {
  ISubmissionUploadProcessingStatusHistoryItem,
  SubmissionUploadJobStatus,
  TicketSubmissionUploadResponse
} from 'interfaces/useTicketsApi.interface';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { createTestQueryClient } from 'test-helpers/query-client';
import { render, screen, waitFor } from 'test-helpers/test-utils';
import { getFormattedDate } from 'utils/Utils';
import { TicketUploadStatusRow } from './TicketUploadStatusRow';

const mocks = vi.hoisted(() => ({ getHistory: vi.fn() }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({ tickets: { getSubmissionUploadProcessingStatusHistory: mocks.getHistory } })
}));

const makeUpload = (uploadStatus: SubmissionUploadJobStatus): TicketSubmissionUploadResponse => ({
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  submission_id: 17,
  upload_id: '44444444-4444-4444-8444-444444444444',
  create_date: '2026-09-03T00:00:00.000Z',
  submission_name: 'Submission',
  submission_description: null,
  submission_comment: null,
  submitted_by_identifier: null,
  upload_status: uploadStatus,
  decision: 'pending',
  validation: null,
  reviews: { validation: [], security: [] }
});

const makeHistoryItem = (
  submissionUploadStatusId: number,
  status: SubmissionUploadJobStatus,
  createDate: string
): ISubmissionUploadProcessingStatusHistoryItem => ({
  submission_upload_status_id: submissionUploadStatusId,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  status,
  create_date: createDate
});

/**
 * Renders the row against a client of its own.
 *
 * @param {TicketSubmissionUploadResponse} upload The upload shown.
 * @param {boolean} [canViewStatusHistory] Whether the viewer may expand the history.
 * @returns The RTL render result and the query client.
 */
const renderRow = (upload: TicketSubmissionUploadResponse, canViewStatusHistory = true) => {
  const queryClient = createTestQueryClient();
  const view = render(<TicketUploadStatusRow upload={upload} canViewStatusHistory={canViewStatusHistory} />, {
    queryClient
  });

  return { ...view, queryClient };
};

describe('TicketUploadStatusRow', () => {
  beforeEach(() => {
    mocks.getHistory.mockReset();
    mocks.getHistory.mockResolvedValue([]);
  });

  it('shows only the current status, collapsed, and requests no history on render', () => {
    renderRow(makeUpload('ingested'));

    const toggle = screen.getByRole('button', { name: 'Ingested' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const region = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(region).not.toBeVisible();
    expect(region).toBeEmptyDOMElement();
    expect(mocks.getHistory).not.toHaveBeenCalled();
  });

  it('renders a static status row with no toggle or request when the viewer cannot see the history', async () => {
    const user = userEvent.setup();
    renderRow(makeUpload('ingested'), false);

    expect(screen.getByText('Ingested')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { hidden: true })).not.toBeInTheDocument();

    await user.click(screen.getByText('Ingested'));

    expect(mocks.getHistory).not.toHaveBeenCalled();
  });

  it('expands on click, requests the history once, and reuses it after collapsing and expanding again', async () => {
    const user = userEvent.setup();
    const upload = makeUpload('ingested');
    renderRow(upload);

    const toggle = screen.getByRole('button', { name: 'Ingested' });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', screen.getByRole('region', { name: 'Processing history' }).id);
    expect(await screen.findByText('No processing history')).toBeVisible();
    expect(mocks.getHistory).toHaveBeenCalledWith(upload.submission_id, upload.submission_upload_id, {
      signal: expect.any(AbortSignal)
    });

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(mocks.getHistory).toHaveBeenCalledTimes(1);
  });

  it('loads the history again once the upload has moved on to another status', async () => {
    const user = userEvent.setup();
    const { rerender } = renderRow(makeUpload('ingesting'));
    await user.click(screen.getByRole('button', { name: 'Ingesting' }));
    await waitFor(() => expect(mocks.getHistory).toHaveBeenCalledTimes(1));

    rerender(<TicketUploadStatusRow upload={makeUpload('ingested')} canViewStatusHistory={true} />);

    await waitFor(() => expect(mocks.getHistory).toHaveBeenCalledTimes(2));
  });

  it('toggles from the keyboard', async () => {
    const user = userEvent.setup();
    renderRow(makeUpload('indexing'));

    await user.tab();
    expect(screen.getByRole('button', { name: 'Indexing' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Indexing' })).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(mocks.getHistory).toHaveBeenCalledTimes(1));

    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Indexing' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the error state with the current status still visible, and retries on the next expansion', async () => {
    const user = userEvent.setup();
    mocks.getHistory.mockRejectedValueOnce(new Error('Forbidden'));
    renderRow(makeUpload('failed'));

    const toggle = screen.getByRole('button', { name: 'Failed' });
    await user.click(toggle);

    expect(await screen.findByText('Failed to load processing history')).toBeVisible();
    expect(toggle).toBeVisible();
    expect(mocks.getHistory).toHaveBeenCalledTimes(1);

    await user.click(toggle);
    await user.click(toggle);

    expect(await screen.findByText('No processing history')).toBeVisible();
    expect(mocks.getHistory).toHaveBeenCalledTimes(2);
  });

  it('keeps the current status visible while the history loads', async () => {
    const user = userEvent.setup();
    mocks.getHistory.mockReturnValue(new Promise(() => undefined));
    renderRow(makeUpload('indexing'));

    await user.click(screen.getByRole('button', { name: 'Indexing' }));

    expect(screen.getByRole('button', { name: 'Indexing' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Processing history' })).toBeVisible();
    expect(screen.queryByText('No processing history')).not.toBeInTheDocument();
  });

  it('renders the history in API order with shared labels and formatted timestamps', async () => {
    const user = userEvent.setup();
    mocks.getHistory.mockResolvedValue([
      makeHistoryItem(3, 'ingested', '2026-09-03T18:45:00.000Z'),
      makeHistoryItem(1, 'uploaded', '2026-09-03T18:30:00.000Z'),
      makeHistoryItem(2, 'ingesting', '2026-09-03T18:31:00.000Z')
    ]);
    renderRow(makeUpload('ingested'));

    await user.click(screen.getByRole('button', { name: 'Ingested' }));

    const items = await screen.findAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      `Ingested${getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, '2026-09-03T18:45:00.000Z')}`,
      `Uploaded${getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, '2026-09-03T18:30:00.000Z')}`,
      `Ingesting${getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, '2026-09-03T18:31:00.000Z')}`
    ]);
    expect(items[0].textContent).toMatch(/Sep 3, 2026, \d{1,2}:45 [ap]m$/);
  });

  it('keeps the icon of a stage that ended in failure instead of marking it completed', async () => {
    const user = userEvent.setup();
    mocks.getHistory.mockResolvedValue([
      makeHistoryItem(1, 'uploaded', '2026-09-03T18:30:00.000Z'),
      makeHistoryItem(2, 'ingesting', '2026-09-03T18:31:00.000Z'),
      makeHistoryItem(3, 'ingested', '2026-09-03T18:32:00.000Z'),
      makeHistoryItem(4, 'indexing', '2026-09-03T18:45:00.000Z'),
      makeHistoryItem(5, 'failed', '2026-09-03T18:46:00.000Z')
    ]);
    renderRow(makeUpload('failed'));

    await user.click(screen.getByRole('button', { name: 'Failed' }));

    const items = await screen.findAllByRole('listitem');
    expect(items.map((item) => item.querySelector('svg path')?.getAttribute('d'))).toEqual([
      mdiCheck,
      mdiCheck,
      mdiCheck,
      mdiProgressClock,
      mdiClose
    ]);
  });

  it('marks every stage the upload moved on from as completed and keeps the current stage icon', async () => {
    const user = userEvent.setup();
    mocks.getHistory.mockResolvedValue([
      makeHistoryItem(1, 'uploaded', '2026-09-03T18:30:00.000Z'),
      makeHistoryItem(2, 'ingesting', '2026-09-03T18:31:00.000Z'),
      makeHistoryItem(3, 'indexing', '2026-09-03T18:45:00.000Z')
    ]);
    renderRow(makeUpload('indexing'));

    await user.click(screen.getByRole('button', { name: 'Indexing' }));

    const items = await screen.findAllByRole('listitem');
    expect(items.map((item) => item.querySelector('svg path')?.getAttribute('d'))).toEqual([
      mdiCheck,
      mdiCheck,
      mdiProgressClock
    ]);
  });

  it('renders a safe fallback for a status the frontend does not know', async () => {
    const user = userEvent.setup();
    mocks.getHistory.mockResolvedValue([
      makeHistoryItem(1, 'archiving' as SubmissionUploadJobStatus, '2026-09-03T18:30:00.000Z')
    ]);
    renderRow(makeUpload('archiving' as SubmissionUploadJobStatus));

    await user.click(screen.getByRole('button', { name: 'Unknown status' }));

    await waitFor(() => expect(screen.getAllByText('Unknown status')).toHaveLength(2));
  });
});
