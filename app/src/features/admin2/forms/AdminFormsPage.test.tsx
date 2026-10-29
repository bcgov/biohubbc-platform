import { cleanup, fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminFormsPage } from './AdminFormsPage';

vi.mock('hooks/useApi');

const mockUseApi = {
  forms: {
    getForms: vi.fn()
  }
};

const renderContainer = () =>
  render(
    <MemoryRouter initialEntries={['/admin/forms']}>
      <Routes>
        <Route path="/admin/forms" element={<AdminFormsPage />} />
        <Route path="/admin/forms/create" element={<div data-testid="create-page" />} />
        <Route path="/admin/forms/:formId/versions/:formVersionId" element={<div data-testid="version-page" />} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminFormsPage', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.forms.getForms.mockResolvedValue({
      forms: [
        {
          form_id: 1,
          slug: 'caribou',
          name: 'Caribou Survey',
          description: null,
          is_public: false,
          create_date: '2026-10-29T12:00:00.000Z',
          form_version_id: 2,
          version_number: 1,
          record_effective_date: '2026-10-29'
        }
      ],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists forms with their slug, access and publication status', async () => {
    const { findByText, getByText } = renderContainer();

    expect(await findByText('Caribou Survey')).toBeInTheDocument();
    expect(getByText('caribou')).toBeInTheDocument();
    expect(getByText('Teams')).toBeInTheDocument();
    expect(getByText('Published')).toBeInTheDocument();
  });

  it("opens a form's latest version", async () => {
    const { findByText, findByTestId } = renderContainer();

    fireEvent.click(await findByText('Caribou Survey'));

    expect(await findByTestId('version-page')).toBeInTheDocument();
  });

  it('opens the builder to create a form', async () => {
    const { getByRole, findByTestId } = renderContainer();

    fireEvent.click(getByRole('button', { name: 'Create Form' }));

    expect(await findByTestId('create-page')).toBeInTheDocument();
  });
});
