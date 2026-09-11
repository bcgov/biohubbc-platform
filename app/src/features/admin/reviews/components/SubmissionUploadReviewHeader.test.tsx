import { screen, within } from '@testing-library/react';
import { DialogContext, defaultSnackbarProps } from 'contexts/dialogContext';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { SubmissionUploadReviewHeader } from './SubmissionUploadReviewHeader';

const dialogContext = {
  setYesNoDialog: vi.fn(),
  yesNoDialogProps: {
    dialogTitle: '',
    dialogText: '',
    open: false,
    onClose: vi.fn(),
    onNo: vi.fn(),
    onYes: vi.fn()
  },
  setErrorDialog: vi.fn(),
  errorDialogProps: {
    dialogTitle: '',
    dialogText: '',
    open: false,
    onClose: vi.fn(),
    onOk: vi.fn()
  },
  setOkDialog: vi.fn(),
  okDialogProps: {
    dialogTitle: '',
    dialogText: '',
    open: false,
    onClose: vi.fn()
  },
  setSnackbar: vi.fn(),
  snackbarProps: defaultSnackbarProps
};

const review: ISubmissionUploadReviewDetail = {
  submission_upload_review_id: '22222222-2222-4222-8222-222222222222',
  submission_upload_id: '11111111-1111-4111-8111-111111111111',
  name: 'My validation review',
  description: 'Review these features carefully.',
  scope: 'validation',
  status: 'in_progress',
  requested_by: 1
};

describe('SubmissionUploadReviewHeader', () => {
  it('renders the review breadcrumbs, name, description, and Features tab', () => {
    render(
      <MemoryRouter>
        <DialogContext.Provider value={dialogContext}>
          <SubmissionUploadReviewHeader
            submissionId={16}
            review={review}
            isSavingStatus={false}
            onStatusActionClick={vi.fn()}
            activeTab="features"
            onTabChange={vi.fn()}
          />
        </DialogContext.Provider>
      </MemoryRouter>
    );

    const breadcrumbs = screen.getByLabelText('review breadcrumb');
    expect(breadcrumbs).toHaveTextContent('Submission/Upload/Review/Validation');
    expect(within(breadcrumbs).getByRole('link', { name: 'Submission' })).toHaveAttribute(
      'href',
      '/admin/submissions/16'
    );
    expect(screen.getByRole('heading', { name: review.name })).toBeVisible();
    expect(screen.getByText(review.description!)).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Features' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Complete Review' })).toHaveClass('MuiButton-colorPrimary');
  });

  it('uses the Security breadcrumb for a security review', () => {
    render(
      <MemoryRouter>
        <DialogContext.Provider value={dialogContext}>
          <SubmissionUploadReviewHeader
            submissionId={16}
            review={{ ...review, scope: 'security' }}
            isSavingStatus={false}
            onStatusActionClick={vi.fn()}
            activeTab="features"
            onTabChange={vi.fn()}
          />
        </DialogContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByLabelText('review breadcrumb')).toHaveTextContent('Submission/Upload/Review/Security');
  });

  it('shows Reopen Review when the review is completed', () => {
    render(
      <MemoryRouter>
        <DialogContext.Provider value={dialogContext}>
          <SubmissionUploadReviewHeader
            submissionId={16}
            review={{ ...review, status: 'completed' }}
            isSavingStatus={false}
            onStatusActionClick={vi.fn()}
            activeTab="features"
            onTabChange={vi.fn()}
          />
        </DialogContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Reopen Review' })).toHaveClass('MuiButton-colorInherit');
  });
});
