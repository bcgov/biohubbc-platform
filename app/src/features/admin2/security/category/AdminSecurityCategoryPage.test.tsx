import { cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminSecurityCategoryPage } from './AdminSecurityCategoryPage';

vi.mock('hooks/useApi');

const mockUseApi = {
  security: {
    getSecurityCategory: vi.fn(),
    getSecurityRules: vi.fn()
  }
};

const renderContainer = (route: string) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin/security/categories/:securityCategoryId" element={<AdminSecurityCategoryPage />} />
        <Route path="/page-not-found" element={<div data-testid="not-found-page" />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminSecurityCategoryPage', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.security.getSecurityCategory.mockResolvedValue({
      security_category_id: 3,
      name: 'Wildlife',
      description: 'Sensitive species',
      create_date: '2026-01-05T12:00:00.000Z',
      created_by_name: 'Robin Admin'
    });
    mockUseApi.security.getSecurityRules.mockResolvedValue({
      reasons: [
        {
          security_rule_id: 7,
          security_category_id: 3,
          category_name: 'Wildlife',
          name: 'Nesting site',
          description: 'Active nests',
          is_active: true,
          feature_count: 4
        }
      ],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the category with only its own rules in a Rules tab', async () => {
    const { findByRole, getByRole, findByText, queryByRole } = renderContainer('/admin/security/categories/3');

    expect(await findByRole('heading', { level: 1, name: 'Wildlife' })).toBeVisible();
    expect(getByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin');
    expect(getByRole('link', { name: 'Security' })).toHaveAttribute('href', '/admin/security');
    expect(getByRole('tab', { name: 'Rules' })).toHaveAttribute('aria-selected', 'true');
    expect(await findByText('Nesting site')).toBeVisible();
    expect(queryByRole('columnheader', { name: 'Category' })).not.toBeInTheDocument();

    expect(mockUseApi.security.getSecurityCategory).toHaveBeenCalledWith(3, expect.anything());
    expect(mockUseApi.security.getSecurityRules).toHaveBeenCalledWith(
      expect.objectContaining({ security_category_id: 3 }),
      expect.anything(),
      expect.anything()
    );
  });

  it('shows the description and creation details in the About tab instead of the header', async () => {
    const { findByRole, getByRole, queryByText } = renderContainer('/admin/security/categories/3');

    expect(await findByRole('heading', { level: 1, name: 'Wildlife' })).toBeVisible();
    expect(queryByText('Sensitive species')).not.toBeInTheDocument();

    fireEvent.click(getByRole('tab', { name: 'About' }));

    const about = within(getByRole('tabpanel', { name: 'About' }));

    expect(about.getByRole('heading', { name: 'About' })).toBeVisible();
    expect(about.getByText('Description')).toBeVisible();
    expect(about.getByText('Sensitive species')).toBeVisible();
    expect(about.getByText('Created Date')).toBeVisible();
    expect(about.getByText(/Jan 5, 2026/)).toBeVisible();
    expect(about.getByText('Created By')).toBeVisible();
    expect(about.getByText('Robin Admin')).toBeVisible();
  });

  it('redirects to not found for an id that is not a number', async () => {
    const { getByTestId } = renderContainer('/admin/security/categories/abc');

    expect(getByTestId('not-found-page')).toBeVisible();
    expect(mockUseApi.security.getSecurityCategory).not.toHaveBeenCalled();
    expect(mockUseApi.security.getSecurityRules).not.toHaveBeenCalled();
  });

  it('redirects to not found when the category does not exist', async () => {
    mockUseApi.security.getSecurityCategory.mockRejectedValue(
      new AxiosError('Not found', '404', undefined, undefined, { status: 404 } as AxiosResponse)
    );

    const { getByTestId } = renderContainer('/admin/security/categories/99');

    await waitFor(() => {
      expect(getByTestId('not-found-page')).toBeVisible();
    });
  });
});
