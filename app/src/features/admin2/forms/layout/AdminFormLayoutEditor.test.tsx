import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DialogContextProvider } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminFormLayoutEditor } from './AdminFormLayoutEditor';
import { EMPTY_FORM_LAYOUT, IFormLayout } from './formLayout';

vi.mock('hooks/useApi');

const pagination = { total: 0, current_page: 1, last_page: 1, per_page: 10 };

const mockUseApi = {
  featureTypes: { getFeatureTypes: vi.fn() },
  contributors: { listContributors: vi.fn(), listContributorCodesets: vi.fn() },
  forms: { createForm: vi.fn(), updateFormVersion: vi.fn(), publishFormVersion: vi.fn(), createFormVersion: vi.fn() }
};

const publishedLayout: IFormLayout = {
  ...EMPTY_FORM_LAYOUT,
  formId: 1,
  formVersionId: 2,
  slug: 'caribou',
  contributorId: 3,
  teamId: 'team-1',
  name: 'Caribou',
  versionNumber: 1,
  isPublished: true
};

const renderEditor = (initialLayout: IFormLayout) =>
  render(
    <DialogContextProvider>
      <MemoryRouter>
        <AdminFormLayoutEditor initialLayout={initialLayout} />
      </MemoryRouter>
    </DialogContextProvider>
  );

describe('AdminFormLayoutEditor', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.featureTypes.getFeatureTypes.mockResolvedValue({ feature_types: [], pagination });
    mockUseApi.contributors.listContributors.mockResolvedValue({
      contributors: [{ contributor_id: 3, client_id: 'caribou-program', description: null, record_end_date: null }],
      pagination
    });
    mockUseApi.contributors.listContributorCodesets.mockResolvedValue({
      codesets: [
        {
          contributor_codeset_id: 50,
          contributor_id: 3,
          key: 'sex',
          label: 'Sex',
          description: null,
          external_id: null,
          record_end_date: null
        }
      ],
      pagination
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('asks for the details of a new form, including its contributor, before the first save', async () => {
    const { getByRole, findByText } = renderEditor(EMPTY_FORM_LAYOUT);

    expect(getByRole('button', { name: 'Publish' })).toBeDisabled();

    fireEvent.click(getByRole('button', { name: 'Save draft' }));

    expect(await findByText('Form Details')).toBeInTheDocument();
    await waitFor(() => expect(mockUseApi.contributors.listContributors).toHaveBeenCalled());
    expect(mockUseApi.forms.createForm).not.toHaveBeenCalled();
  });

  it('shows a published version read-only, with a revision and its administrators', async () => {
    mockUseApi.forms.createFormVersion.mockRejectedValue(new Error('not reached'));
    const { getByRole, queryByRole } = renderEditor(publishedLayout);

    expect(getByRole('button', { name: 'Revise' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Administrators' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Access' })).toBeInTheDocument();
    expect(queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
  });

  it('creates a revision of a published version and moves to it', async () => {
    mockUseApi.forms.createFormVersion.mockResolvedValue({
      form: {
        form_id: 1,
        slug: 'caribou',
        contributor_id: 3,
        team_id: 'team-1',
        name: 'Caribou',
        description: null,
        is_public: false,
        record_end_date: null
      },
      form_version: {
        form_version_id: 3,
        form_id: 1,
        blueprint_id: 5,
        version_number: 2,
        record_effective_date: null,
        record_end_date: null
      },
      sections: []
    });
    const { getByRole, findByRole } = renderEditor(publishedLayout);

    fireEvent.click(getByRole('button', { name: 'Revise' }));

    await waitFor(() => expect(mockUseApi.forms.createFormVersion).toHaveBeenCalledWith(1));
    expect(await findByRole('button', { name: 'Save draft' })).toBeInTheDocument();
  });
});
