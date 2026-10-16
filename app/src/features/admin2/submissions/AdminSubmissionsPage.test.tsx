import { cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { vi } from 'vitest';
import { AdminSubmissionsPage } from './AdminSubmissionsPage';

vi.mock('features/admin/dashboard/components/UnreviewedSubmissionsTable', () => ({
  default: () => <div data-testid="unreviewed-submissions" />
}));
vi.mock('features/admin/dashboard/components/ReviewedSubmissionsTable', () => ({
  default: () => <div data-testid="reviewed-submissions" />
}));
vi.mock('features/admin/dashboard/components/PublishedSubmissionsTable', () => ({
  default: () => <div data-testid="published-submissions" />
}));

const renderContainer = () => {
  return render(
    <MemoryRouter initialEntries={['/admin/submissions']}>
      <AdminSubmissionsPage />
    </MemoryRouter>
  );
};

describe('AdminSubmissionsPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows submissions pending review by default', () => {
    const { getByRole, getByTestId, queryByTestId } = renderContainer();

    expect(getByRole('heading', { level: 1, name: 'Submissions' })).toBeVisible();
    expect(getByRole('button', { name: 'New Submission' })).toBeVisible();
    expect(getByRole('tab', { name: 'Pending Review' })).toHaveAttribute('aria-selected', 'true');
    expect(getByTestId('unreviewed-submissions')).toBeVisible();
    expect(queryByTestId('reviewed-submissions')).not.toBeInTheDocument();
    expect(queryByTestId('published-submissions')).not.toBeInTheDocument();
  });

  it('shows only the list of the selected tab', () => {
    const { getByRole, getByTestId, queryByTestId } = renderContainer();

    fireEvent.click(getByRole('tab', { name: 'Published' }));

    expect(getByTestId('published-submissions')).toBeVisible();
    expect(queryByTestId('unreviewed-submissions')).not.toBeInTheDocument();
  });
});
