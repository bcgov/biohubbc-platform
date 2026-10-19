import { cleanup } from '@testing-library/react';
import { SYSTEM_ROLE } from 'constants/roles';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminPage } from './AdminPage';

vi.mock('hooks/useAuthStateContext');

const mockUseAuthStateContext = useAuthStateContext as Mock;

const renderContainer = () => {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminPage />
    </MemoryRouter>
  );
};

describe('AdminPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('links a system administrator to every administrative section', () => {
    mockUseAuthStateContext.mockReturnValue({ biohubUserWrapper: { roleNames: [SYSTEM_ROLE.SYSTEM_ADMIN] } });

    const { getByRole, queryByRole } = renderContainer();

    expect(getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/admin/tickets');
    expect(getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
    expect(getByRole('link', { name: 'Submissions' })).toHaveAttribute('href', '/admin/submissions');
    expect(getByRole('link', { name: 'Security' })).toHaveAttribute('href', '/admin/security');
    expect(getByRole('link', { name: 'Data Requests' })).toHaveAttribute('href', '/admin/data-requests');
    expect(getByRole('link', { name: 'Configuration' })).toHaveAttribute('href', '/admin/configuration');
    expect(queryByRole('link', { name: 'Tag Rules' })).not.toBeInTheDocument();
  });

  it('shows a data administrator only the sections their role can open', () => {
    mockUseAuthStateContext.mockReturnValue({ biohubUserWrapper: { roleNames: [SYSTEM_ROLE.DATA_ADMINISTRATOR] } });

    const { getAllByRole } = renderContainer();

    const links = getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin/security',
      '/admin/submissions',
      '/admin/data-requests'
    ]);
  });
});
