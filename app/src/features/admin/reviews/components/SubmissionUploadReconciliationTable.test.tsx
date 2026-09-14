import { screen } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { SubmissionUploadReconciliationTable } from './SubmissionUploadReconciliationTable';

describe('SubmissionUploadReconciliationTable', () => {
  it('renders each reconciliation outcome count', () => {
    render(<SubmissionUploadReconciliationTable counts={{ new: 4, unmodified: 7, modified: 2 }} />);

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeVisible();
    expect(screen.getByRole('grid')).toBeVisible();
    expect(screen.getByRole('row', { name: 'New 4' })).toBeVisible();
    expect(screen.getByRole('row', { name: 'Unmodified 7' })).toBeVisible();
    expect(screen.getByRole('row', { name: 'Modified 2' })).toBeVisible();
  });
});
