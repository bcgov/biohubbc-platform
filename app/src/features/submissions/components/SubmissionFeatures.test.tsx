import { fireEvent, screen, waitFor } from '@testing-library/react';
import { SearchResultContentProps } from 'features/search/result/content/SearchResultContent';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { encodeExpressionToUrl } from 'utils/expression-url';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { SubmissionFeatures } from './SubmissionFeatures';

// Use one router module for the DOM components and shared query hooks in Vitest.
vi.mock('react-router-dom', () => vi.importActual('react-router'));

const mocks = vi.hoisted(() => ({ searchFeatures: vi.fn(), countFeatures: vi.fn(), setSnackbar: vi.fn() }));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar })
}));

vi.mock('hooks/useApi', () => ({
  useApi: () => ({ search: { searchFeatures: mocks.searchFeatures, countFeatures: mocks.countFeatures } })
}));

// Keep the actual URL, expression, pagination and request hooks; only replace presentation.
vi.mock('features/search/result/header/SearchResultSearch', () => ({ SearchResultSearch: () => null }));
vi.mock('features/search/result/content/SearchResultContent', () => ({
  SearchResultContent: ({
    onPageChange,
    onResultClick
  }: Pick<SearchResultContentProps, 'onPageChange' | 'onResultClick'>) => (
    <>
      <button onClick={() => onPageChange('NextCursor')}>Next page</button>
      <button
        onClick={() =>
          onResultClick({ submission_id: 1, submission_feature_id: 10 } as Parameters<
            SearchResultContentProps['onResultClick']
          >[0])
        }>
        Open feature
      </button>
    </>
  )
}));

const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
};

const FeaturePage = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back to submission</button>;
};

const renderFeatures = (search = '', featureTypes = ['survey', 'animal']) =>
  render(
    <MemoryRouter initialEntries={[`/submission/1${search}`]}>
      <Location />
      <Routes>
        <Route
          path="/submission/:submissionId"
          element={<SubmissionFeatures submissionId={1} featureTypes={featureTypes} />}
        />
        <Route path="/submission/:submissionId/feature/:featureId" element={<FeaturePage />} />
      </Routes>
    </MemoryRouter>
  );

describe('SubmissionFeatures URL state', () => {
  beforeEach(() => {
    mocks.searchFeatures.mockReset();
    mocks.countFeatures.mockReset().mockResolvedValue({ total: 100 });
    mocks.searchFeatures.mockImplementation(async (_type, _expression, pagination) => ({
      features: [],
      properties: [],
      pagination: {
        limit: pagination.limit,
        sort: pagination.sort,
        order: pagination.order,
        next_cursor: null,
        previous_cursor: null
      },
      has_inaccessible_secured_features: false
    }));
  });

  it.each(['?cursor=GlobalCursor&limit=25', '?feature_type=missing&cursor=GlobalCursor&limit=25'])(
    'establishes a valid feature type and resets incoming pagination before searching: %s',
    async (search) => {
      renderFeatures(search);
      await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(1));
      expect(mocks.searchFeatures).toHaveBeenCalledWith(
        'survey',
        null,
        expect.objectContaining({ cursor: undefined, limit: 25 }),
        expect.objectContaining({ submissionIds: [1] })
      );
      expect(screen.getByTestId('location').textContent).toContain('feature_type=survey');
      expect(screen.getByTestId('location').textContent).not.toContain('cursor=');
    }
  );

  it('preserves the expression and sort when establishing submission pagination', async () => {
    const expression: ExpressionTreeExpression = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          blueprint_feature_type_property_id: null,
          operator: 'Equals',
          value: 'Moose'
        }
      ]
    };
    const encoded = encodeExpressionToUrl(expression);
    renderFeatures(`?cursor=GlobalCursor&sort=create_date&order=desc&expr=${encoded}`);
    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(1));
    expect(mocks.searchFeatures).toHaveBeenCalledWith(
      'survey',
      expression,
      expect.objectContaining({ cursor: undefined, sort: 'create_date', order: 'desc' }),
      expect.objectContaining({ submissionIds: [1] })
    );
    expect(screen.getByTestId('location').textContent).toContain(`expr=${encoded}`);
  });

  it('restores a bookmarked feature type and its page', async () => {
    renderFeatures('?feature_type=animal&cursor=SavedCursor');
    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(1));
    expect(mocks.searchFeatures).toHaveBeenCalledWith(
      'animal',
      null,
      expect.objectContaining({ cursor: 'SavedCursor' }),
      expect.objectContaining({ submissionIds: [1] })
    );
    expect(screen.getByRole('button', { name: 'Animal' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('resets the page when switching types and restores selection and pagination after visiting a feature', async () => {
    renderFeatures('?feature_type=survey&cursor=SavedCursor');
    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Animal' }));
    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(2));
    expect(mocks.searchFeatures).toHaveBeenLastCalledWith(
      'animal',
      null,
      expect.objectContaining({ cursor: undefined }),
      expect.objectContaining({ submissionIds: [1] })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole('button', { name: 'Open feature' }));
    expect(screen.getByTestId('location').textContent).toContain(
      '/submission/1/feature/10?feature_type=animal&cursor=NextCursor'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to submission' }));
    await waitFor(() => expect(mocks.searchFeatures).toHaveBeenCalledTimes(4));
    expect(mocks.searchFeatures).toHaveBeenLastCalledWith(
      'animal',
      null,
      expect.objectContaining({ cursor: 'NextCursor' }),
      expect.objectContaining({ submissionIds: [1] })
    );
    expect(screen.getByRole('button', { name: 'Animal' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an empty feature section without querying when no feature types are available', () => {
    renderFeatures('?page=5', []);
    expect(screen.getByText('No searchable features available.')).toBeVisible();
    expect(mocks.searchFeatures).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Submission feature types' })).not.toBeInTheDocument();
  });
});
