import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketSubmissionUploadResponse } from 'interfaces/useTicketsApi.interface';
import { render } from 'test-helpers/test-utils';
import { TicketUploadTimelineItem } from './TicketUploadTimelineItem';

const upload: TicketSubmissionUploadResponse = {
  submission_upload_id: '22222222-2222-4222-8222-222222222222',
  submission_id: 17,
  upload_id: '33333333-3333-4333-8333-333333333333',
  create_date: '2026-09-04T12:00:00.000Z',
  submission_name: 'Test submission',
  submission_description: 'Existing upload',
  submission_comment: null,
  submitted_by_identifier: 'admin@example.com',
  upload_status: 'indexed',
  review_status: 'submitted',
  validation: null,
  reviews: {
    security: [
      {
        submission_upload_review_id: '44444444-4444-4444-8444-444444444444',
        submission_upload_id: '22222222-2222-4222-8222-222222222222',
        name: 'Access rules',
        description: 'Review access rules',
        scope: 'security',
        status: 'requested',
        requested_by: 7
      },
      {
        submission_upload_review_id: '66666666-6666-4666-8666-666666666666',
        submission_upload_id: '22222222-2222-4222-8222-222222222222',
        name: 'Malware findings',
        description: null,
        scope: 'security',
        status: 'completed',
        requested_by: 8
      }
    ],
    validation: [
      {
        submission_upload_review_id: '55555555-5555-4555-8555-555555555555',
        submission_upload_id: '22222222-2222-4222-8222-222222222222',
        name: 'Species values',
        description: 'Review species validation',
        scope: 'validation',
        status: 'completed',
        requested_by: 7
      }
    ]
  }
};

const baseProps = {
  upload,
  dateLabel: 'Today',
  onCreateReview: vi.fn(),
  onOpenReview: vi.fn(),
  onAccept: vi.fn(),
  onReject: vi.fn(),
  onResetDecision: vi.fn()
};

describe('TicketUploadTimelineItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists every existing scoped review under Continue and opens the selected review', async () => {
    const user = userEvent.setup();
    render(<TicketUploadTimelineItem {...baseProps} />);

    const completedButton = screen.getByRole('button', { name: 'Completed' });
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(completedButton).toHaveClass('MuiButton-colorSuccess');
    expect(continueButton).toHaveClass('MuiButton-colorPrimary');
    expect(continueButton.querySelector('.MuiButton-endIcon svg')).toBeVisible();

    await user.click(continueButton);
    expect(screen.getByRole('menuitem', { name: 'Access rules' })).not.toHaveClass('Mui-selected');
    const completedReview = screen.getByRole('menuitem', { name: 'Malware findings' });

    await user.click(completedReview);
    expect(baseProps.onOpenReview).toHaveBeenCalledWith(
      upload,
      'security',
      upload.reviews.security[1].submission_upload_review_id
    );
    expect(baseProps.onCreateReview).not.toHaveBeenCalled();
  });

  it('starts another independent review from an existing review scope menu', async () => {
    const user = userEvent.setup();
    render(<TicketUploadTimelineItem {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('menuitem', { name: 'New Review' }));

    expect(screen.getByRole('dialog', { name: 'Create Security Review' })).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Second security review' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Review another security concern' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(baseProps.onCreateReview).toHaveBeenCalledWith(upload, 'security', {
      name: 'Second security review',
      description: 'Review another security concern'
    });
    expect(baseProps.onOpenReview).not.toHaveBeenCalled();
  });

  it('shows Review with primary color and creates a validation review only when no review exists', async () => {
    const user = userEvent.setup();
    const uploadWithoutValidationReview = {
      ...upload,
      reviews: {
        ...upload.reviews,
        validation: []
      }
    };
    render(<TicketUploadTimelineItem {...baseProps} upload={uploadWithoutValidationReview} />);

    const reviewButton = screen.getByRole('button', { name: 'Review' });
    expect(reviewButton).toHaveClass('MuiButton-colorPrimary');

    await user.click(reviewButton);

    expect(screen.getByRole('dialog', { name: 'Create Validation Review' })).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Taxonomy review' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(baseProps.onCreateReview).toHaveBeenCalledWith(uploadWithoutValidationReview, 'validation', {
      name: 'Taxonomy review',
      description: null
    });
  });
});
