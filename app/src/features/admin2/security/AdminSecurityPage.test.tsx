import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminSecurityPage } from './AdminSecurityPage';

vi.mock('hooks/useApi');

const mockUseApi = {
  security: {
    getSecurityCategories: vi.fn()
  }
};

const renderContainer = () => {
  return render(
    <MemoryRouter initialEntries={['/admin/security']}>
      <Routes>
        <Route path="/admin/security" element={<AdminSecurityPage />} />
        <Route path="/admin/security/categories/:securityCategoryId" element={<div data-testid="category-page" />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminSecurityPage', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.security.getSecurityCategories.mockResolvedValue({
      categories: [{ security_category_id: 3, name: 'Wildlife', description: 'Sensitive species', rule_count: 2 }],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the categories as the only tab', async () => {
    const { getByRole, getAllByRole, findByText } = renderContainer();

    expect(getByRole('heading', { level: 1, name: 'Security' })).toBeVisible();
    expect(getAllByRole('tab')).toHaveLength(1);
    expect(getByRole('tab', { name: 'Categories' })).toHaveAttribute('aria-selected', 'true');
    expect(await findByText('Wildlife')).toBeVisible();
  });

  it('opens the category page when a category is clicked', async () => {
    const { findByText, getByTestId } = renderContainer();

    fireEvent.click(await findByText('Wildlife'));

    await waitFor(() => {
      expect(getByTestId('category-page')).toBeVisible();
    });
  });
});
