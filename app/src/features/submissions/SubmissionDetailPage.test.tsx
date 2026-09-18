import { act, fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { SubmissionDetailPage } from './SubmissionDetailPage';

vi.mock('../../hooks/useApi');
vi.mock('features/search/result/hooks/useSearchResults');
vi.mock('features/search/result/hooks/useSearchResultExpression', () => ({
  useSearchResultExpression: () => ({
    expressionTree: null,
    expressionApplyRevision: 0,
    handleExpressionApply: vi.fn()
  })
}));
vi.mock('features/search/result/hooks/useSearchResultPagingSort', () => ({
  useSearchResultPagingSort: () => ({
    activeSort: 'relevancy_score',
    sortOptions: [],
    handleSortChange: vi.fn(),
    handlePageChange: vi.fn(),
    handlePageSizeChange: vi.fn()
  })
}));
vi.mock('features/search/result/layout/map/SearchResultMapContainer', () => ({
  SearchResultMapContainer: () => <div>Map</div>
}));

import { useSearchResults } from 'features/search/result/hooks/useSearchResults';

const mockUseApi = useApi as Mock;
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const mockGetSubmissionRecordWithSecurity = vi.fn();
const mockUseSearchResults = useSearchResults as Mock;

const mockSubmission = {
  submission_id: 1,
  uuid: 'uuid-1',
  security_review_timestamp: null,
  publish_timestamp: null,
  submitted_timestamp: null,
  source_system: 'SIMS',
  name: 'Test Submission',
  description: 'A test submission',
  comment: null,
  create_date: '2026-01-01T00:00:00.000Z',
  create_user: 1,
  update_date: null,
  update_user: null,
  revision_count: 0,
  security: 'UNSECURED',
  contributor_name: 'SIMS',
  last_approved_upload_date: '2026-02-03T12:00:00.000Z',
  feature_types: ['observation', 'survey']
};

const mockSearchResults = {
  rows: [
    {
      submission_feature_id: 10,
      uuid: 'feat-uuid-1',
      submission_id: 1,
      feature_type_id: 100,
      feature_type_name: 'Observation',
      properties: { species: 'Wolf' },
      submission_name: 'Test Submission',
      is_secured: false,
      relevancy_score: 1,
      create_date: '2026-01-01T00:00:00.000Z'
    },
    {
      submission_feature_id: 20,
      uuid: 'feat-uuid-2',
      submission_id: 1,
      feature_type_id: 100,
      feature_type_name: 'Observation',
      properties: { species: 'Bear' },
      submission_name: 'Test Submission',
      is_secured: false,
      relevancy_score: 1,
      create_date: '2026-01-01T00:00:00.000Z'
    }
  ],
  properties: [
    {
      feature_type_property_id: 1,
      feature_property_id: 1,
      feature_property_type_id: 1,
      name: 'species',
      display_name: 'Species',
      description: '',
      type_name: 'string',
      required_value: false,
      calculated_value: false,
      allow_multiple: false
    }
  ],
  hasMoreSecuredFeatures: false,
  isLoading: false,
  totalCount: 2,
  cursor: { limit: 10, sort: 'relevancy_score', order: 'desc', next: null, previous: null },
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn()
};

const renderPage = (search = '?feature_type=observation') =>
  render(
    <MemoryRouter initialEntries={[`/submission/1${search}`]}>
      <Routes>
        <Route path="/submission/:submissionId" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('SubmissionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      submissions: {
        getSubmissionRecordWithSecurity: mockGetSubmissionRecordWithSecurity,
        getSubmissionFeatures: vi.fn()
      }
    });

    mockGetSubmissionRecordWithSecurity.mockResolvedValue(mockSubmission);
    mockUseSearchResults.mockReturnValue(mockSearchResults);
  });

  it.each([false, true])(
    'isolates data when the submission ID changes (previous request pending: %s)',
    async (pending) => {
      let resolveFirst!: (value: typeof mockSubmission) => void;
      let resolveSecond!: (value: typeof mockSubmission) => void;
      const first = new Promise<typeof mockSubmission>((resolve) => {
        resolveFirst = resolve;
      });
      const second = new Promise<typeof mockSubmission>((resolve) => {
        resolveSecond = resolve;
      });
      mockGetSubmissionRecordWithSecurity.mockImplementation((id: number) => (id === 1 ? first : second));
      const { getByText, findByRole, queryByRole } = render(
        <MemoryRouter initialEntries={['/submission/1?feature_type=observation']}>
          <Link to="/submission/2?feature_type=observation">Next submission</Link>
          <Routes>
            <Route path="/submission/:submissionId" element={<SubmissionDetailPage />} />
          </Routes>
        </MemoryRouter>
      );
      await waitFor(() => expect(mockGetSubmissionRecordWithSecurity).toHaveBeenCalledWith(1));
      if (!pending) {
        await act(async () => resolveFirst(mockSubmission));
        await findByRole('heading', { name: 'Test Submission' });
      }

      fireEvent.click(getByText('Next submission'));
      await waitFor(() => expect(mockGetSubmissionRecordWithSecurity).toHaveBeenCalledWith(2));
      expect(queryByRole('heading', { name: 'Test Submission' })).not.toBeInTheDocument();

      await act(async () => resolveSecond({ ...mockSubmission, submission_id: 2, name: 'Second Submission' }));
      await findByRole('heading', { name: 'Second Submission' });
      if (pending) {
        await act(async () => resolveFirst(mockSubmission));
      }
      expect(queryByRole('heading', { name: 'Test Submission' })).not.toBeInTheDocument();
      expect(mockUseSearchResults).toHaveBeenLastCalledWith('observation', true, null, 0, [2]);
    }
  );

  it('renders submission feature rows', async () => {
    const { findByText } = renderPage();

    expect(await findByText('Wolf')).toBeVisible();
    expect(await findByText('Bear')).toBeVisible();
  });

  it('renders Details as the selected tab', async () => {
    const { findByRole } = renderPage();

    expect(await findByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders feature type toggles in a sidebar and changes the searched feature type', async () => {
    const { findByRole, getByRole } = renderPage();

    const featureTypeGroup = await findByRole('group', { name: 'Submission feature types' });
    const featuresHeading = getByRole('heading', { name: 'Features' });
    const observationToggle = getByRole('button', { name: 'Observation' });
    const surveyToggle = getByRole('button', { name: 'Survey' });
    const tableButton = getByRole('button', { name: 'Table' });

    expect(featureTypeGroup).toHaveAttribute('aria-orientation', 'vertical');
    expect(featuresHeading).toBeVisible();
    expect(observationToggle).toHaveAttribute('aria-pressed', 'true');
    expect(featureTypeGroup.compareDocumentPosition(tableButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(surveyToggle);

    await waitFor(() => {
      expect(mockSearchResults.setSearchParams).toHaveBeenCalledWith({ feature_type: 'survey' });
    });
  });

  it('renders the result search above the sort toolbar', async () => {
    const { findByPlaceholderText, getByRole } = renderPage();

    const search = await findByPlaceholderText('Search...');
    const featuresHeading = getByRole('heading', { name: 'Features' });
    const featureTypeGroup = getByRole('group', { name: 'Submission feature types' });
    const tableButton = getByRole('button', { name: 'Table' });

    expect(featuresHeading.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search.compareDocumentPosition(featureTypeGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search.compareDocumentPosition(tableButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses the first feature type returned by the submission endpoint for the initial search', async () => {
    mockGetSubmissionRecordWithSecurity.mockResolvedValue({
      ...mockSubmission,
      feature_types: ['survey', 'observation']
    });

    renderPage('');

    await waitFor(() => {
      expect(mockSearchResults.setSearchParams).toHaveBeenCalledWith({ feature_type: 'survey' });
    });
  });

  it('renders the About section with create date, last updated, and contributor rows', async () => {
    const { findByRole, findByText } = renderPage();

    expect(await findByRole('heading', { name: 'About' })).toBeVisible();
    expect(await findByText('Create date')).toBeVisible();
    expect(await findByText('Last updated')).toBeVisible();
    expect(await findByText('Contributor')).toBeVisible();
    expect(await findByText('SIMS')).toBeVisible();
    expect(await findByText('February 3, 2026')).toBeVisible();
  });

  it('keeps the submission header and About section visible while its feature graph is unavailable', async () => {
    mockGetSubmissionRecordWithSecurity.mockResolvedValue({
      ...mockSubmission,
      feature_types: [],
      security: 'PENDING'
    });
    const { findByText, findByRole, queryByText } = renderPage();
    expect(await findByText('No searchable features available.')).toBeVisible();
    expect(await findByRole('heading', { name: 'Test Submission' })).toBeVisible();
    expect(await findByRole('heading', { name: 'About' })).toBeVisible();
    expect(queryByText('No submission found')).not.toBeInTheDocument();
  });

  it('renders AlertBanner when there are secured features', async () => {
    mockGetSubmissionRecordWithSecurity.mockResolvedValue({ ...mockSubmission, security: 'PARTIALLY SECURED' });

    const { findByText } = renderPage();

    expect(await findByText('Some of the features are secured.')).toBeVisible();
  });

  it('navigates to feature page when a row is clicked', async () => {
    const { findByText } = renderPage();

    const row = await findByText('Wolf');
    fireEvent.click(row.closest('.MuiDataGrid-row')!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/submission/1/feature/10?feature_type=observation');
    });
  });
});
