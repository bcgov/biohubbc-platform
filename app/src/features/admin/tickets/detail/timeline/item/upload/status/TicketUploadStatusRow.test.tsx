import { mdiCheck, mdiProgressClock } from '@mdi/js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ISubmissionUploadProcessingStatusHistoryItem,
  SubmissionUploadJobStatus,
  TicketSubmissionUploadResponse
} from 'interfaces/useTicketsApi.interface';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { render } from 'test-helpers/test-utils';
import { getFormattedDate } from 'utils/Utils';
import { SubmissionUploadStatusHistoryState } from '../../../hooks/upload/useSubmissionUploadStatusHistory';
import { TicketUploadStatusRow } from './TicketUploadStatusRow';

const makeUpload = (uploadStatus: SubmissionUploadJobStatus): TicketSubmissionUploadResponse => ({
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  submission_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  upload_id: '44444444-4444-4444-8444-444444444444',
  create_date: '2026-09-03T00:00:00.000Z',
  submission_name: 'Submission',
  submission_description: null,
  submission_comment: null,
  submitted_by_identifier: null,
  upload_status: uploadStatus,
  review_status: 'submitted',
  validation: null,
  reviews: { validation: null, security: null }
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

const renderRow = (
  upload: TicketSubmissionUploadResponse,
  statusHistory: SubmissionUploadStatusHistoryState | undefined,
  onLoadStatusHistory = vi.fn()
) => {
  const view = render(
    <TicketUploadStatusRow upload={upload} statusHistory={statusHistory} onLoadStatusHistory={onLoadStatusHistory} />
  );

  return { ...view, onLoadStatusHistory };
};

describe('TicketUploadStatusRow', () => {
  it('shows only the current status, collapsed, and requests no history on render', () => {
    const { onLoadStatusHistory } = renderRow(makeUpload('ingested'), undefined);

    const toggle = screen.getByRole('button', { name: 'Ingested' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).not.toBeVisible();
    expect(onLoadStatusHistory).not.toHaveBeenCalled();
  });

  it('expands on click, requests the history, and collapses on the next click', async () => {
    const user = userEvent.setup();
    const upload = makeUpload('ingested');
    const { onLoadStatusHistory } = renderRow(upload, undefined);

    const toggle = screen.getByRole('button', { name: 'Ingested' });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', screen.getByRole('region', { name: 'Processing history' }).id);
    expect(onLoadStatusHistory).toHaveBeenCalledTimes(1);
    expect(onLoadStatusHistory).toHaveBeenCalledWith(upload);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(onLoadStatusHistory).toHaveBeenCalledTimes(1);
  });

  it('toggles from the keyboard', async () => {
    const user = userEvent.setup();
    const { onLoadStatusHistory } = renderRow(makeUpload('indexing'), undefined);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Indexing' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Indexing' })).toHaveAttribute('aria-expanded', 'true');
    expect(onLoadStatusHistory).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Indexing' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('asks for the history again on every expansion so a failed request is retried', async () => {
    const user = userEvent.setup();
    const { onLoadStatusHistory } = renderRow(makeUpload('failed'), { status: 'error', message: 'Forbidden' });

    const toggle = screen.getByRole('button', { name: 'Failed' });
    await user.click(toggle);
    await user.click(toggle);
    await user.click(toggle);

    expect(onLoadStatusHistory).toHaveBeenCalledTimes(2);
  });

  it('keeps the current status visible while the history loads', async () => {
    const user = userEvent.setup();
    renderRow(makeUpload('reconciling'), { status: 'loading' });

    await user.click(screen.getByRole('button', { name: 'Reconciling' }));

    expect(screen.getByRole('button', { name: 'Reconciling' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Processing history' })).toBeVisible();
    expect(screen.queryByText('No processing history')).not.toBeInTheDocument();
  });

  it('shows the error state with the current status still visible', async () => {
    const user = userEvent.setup();
    renderRow(makeUpload('failed'), { status: 'error', message: 'Forbidden' });

    await user.click(screen.getByRole('button', { name: 'Failed' }));

    expect(screen.getByText('Failed to load processing history')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Failed' })).toBeVisible();
  });

  it('shows the empty state when the upload has no history', async () => {
    const user = userEvent.setup();
    renderRow(makeUpload('uploaded'), { status: 'loaded', history: [] });

    await user.click(screen.getByRole('button', { name: 'Uploaded' }));

    expect(screen.getByText('No processing history')).toBeVisible();
  });

  it('renders the history in API order with shared labels and formatted timestamps', async () => {
    const user = userEvent.setup();
    renderRow(makeUpload('ingested'), {
      status: 'loaded',
      history: [
        makeHistoryItem(3, 'ingested', '2026-09-03T18:45:00.000Z'),
        makeHistoryItem(1, 'uploaded', '2026-09-03T18:30:00.000Z'),
        makeHistoryItem(2, 'ingesting', '2026-09-03T18:31:00.000Z')
      ]
    });

    await user.click(screen.getByRole('button', { name: 'Ingested' }));

    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      `Ingested${getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, '2026-09-03T18:45:00.000Z')}`,
      `Uploaded${getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, '2026-09-03T18:30:00.000Z')}`,
      `Ingesting${getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, '2026-09-03T18:31:00.000Z')}`
    ]);
    expect(items[0].textContent).toMatch(/Sep 3, 2026, \d{1,2}:45 [ap]m$/);
  });

  it('marks every stage before the current one as completed and keeps the current stage icon', async () => {
    const user = userEvent.setup();
    renderRow(makeUpload('reconciling'), {
      status: 'loaded',
      history: [
        makeHistoryItem(1, 'uploaded', '2026-09-03T18:30:00.000Z'),
        makeHistoryItem(2, 'ingesting', '2026-09-03T18:31:00.000Z'),
        makeHistoryItem(3, 'reconciling', '2026-09-03T18:45:00.000Z')
      ]
    });

    await user.click(screen.getByRole('button', { name: 'Reconciling' }));

    const iconPaths = screen.getAllByRole('listitem').map((item) => item.querySelector('svg path')?.getAttribute('d'));
    expect(iconPaths).toEqual([mdiCheck, mdiCheck, mdiProgressClock]);
  });

  it('renders a safe fallback for a status the frontend does not know', async () => {
    const user = userEvent.setup();
    renderRow(makeUpload('archiving' as SubmissionUploadJobStatus), {
      status: 'loaded',
      history: [makeHistoryItem(1, 'archiving' as SubmissionUploadJobStatus, '2026-09-03T18:30:00.000Z')]
    });

    await user.click(screen.getByRole('button', { name: 'Unknown status' }));

    expect(screen.getAllByText('Unknown status')).toHaveLength(2);
  });
});
