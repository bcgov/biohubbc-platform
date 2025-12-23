import { fireEvent, waitFor } from '@testing-library/react';
import { SearchFeatureResult } from 'interfaces/useSearchApi.interface';
import { render } from 'test-helpers/test-utils';
import SearchResultsList from './SearchResultsList';

const mockOnDownload = vi.fn();
const mockOnAccessRequest = vi.fn();

const renderComponent = (results: SearchFeatureResult[]) =>
  render(<SearchResultsList results={results} onDownload={mockOnDownload} onAccessRequest={mockOnAccessRequest} />);

const createMockResult = (overrides: Partial<SearchFeatureResult> = {}): SearchFeatureResult => ({
  submission_feature_id: 1,
  submission_id: 10,
  uuid: '550e8400-e29b-41d4-a716-446655440001',
  feature_type_id: 1,
  feature_type_name: 'dataset',
  feature_name: 'Test Feature',
  feature_description: 'A test feature description',
  submission_name: 'Test Submission',
  is_secured: false,
  relevancy_score: 0.85,
  ...overrides
});

describe('SearchResultsList', () => {
  beforeEach(() => {
    mockOnDownload.mockClear();
    mockOnAccessRequest.mockClear();
  });

  describe('Empty State', () => {
    it('should render empty state when no results', async () => {
      const { getByTestId, getByText } = renderComponent([]);

      await waitFor(() => {
        expect(getByTestId('no-search-results')).toBeVisible();
        expect(getByText('No features found')).toBeVisible();
        expect(getByText(/Try different keywords/i)).toBeVisible();
      });
    });
  });

  describe('Feature Card Rendering', () => {
    it('should render feature name', async () => {
      const result = createMockResult({ feature_name: 'Moose Population Study' });
      const { getByText } = renderComponent([result]);

      await waitFor(() => {
        expect(getByText('Moose Population Study')).toBeVisible();
      });
    });

    it('should render fallback name when feature_name is null', async () => {
      const result = createMockResult({ feature_name: null, submission_feature_id: 42 });
      const { getByText } = renderComponent([result]);

      await waitFor(() => {
        expect(getByText('Feature #42')).toBeVisible();
      });
    });

    it('should render feature type chip', async () => {
      const result = createMockResult({ feature_type_name: 'observation' });
      const { getByText } = renderComponent([result]);

      await waitFor(() => {
        expect(getByText('observation')).toBeVisible();
      });
    });

    it('should render parent submission name', async () => {
      const result = createMockResult({ submission_name: 'Wildlife Survey 2024' });
      const { getByText } = renderComponent([result]);

      await waitFor(() => {
        expect(getByText('From: Wildlife Survey 2024')).toBeVisible();
      });
    });

    it('should render feature description when present', async () => {
      const result = createMockResult({ feature_description: 'Detailed description of the feature' });
      const { getByText } = renderComponent([result]);

      await waitFor(() => {
        expect(getByText('Detailed description of the feature')).toBeVisible();
      });
    });

    it('should not render description when null', async () => {
      const result = createMockResult({ feature_description: null });
      const { queryByText } = renderComponent([result]);

      await waitFor(() => {
        expect(queryByText('Detailed description')).toBeNull();
      });
    });

    it('should render multiple results', async () => {
      const results = [
        createMockResult({ submission_feature_id: 1, feature_name: 'Feature One' }),
        createMockResult({ submission_feature_id: 2, feature_name: 'Feature Two' }),
        createMockResult({ submission_feature_id: 3, feature_name: 'Feature Three' })
      ];
      const { getByText } = renderComponent(results);

      await waitFor(() => {
        expect(getByText('Feature One')).toBeVisible();
        expect(getByText('Feature Two')).toBeVisible();
        expect(getByText('Feature Three')).toBeVisible();
      });
    });
  });

  describe('Secured vs Unsecured Display', () => {
    it('should show Download button for unsecured features', async () => {
      const result = createMockResult({ is_secured: false });
      const { getByRole, queryByRole } = renderComponent([result]);

      await waitFor(() => {
        expect(getByRole('button', { name: /download/i })).toBeVisible();
        expect(queryByRole('button', { name: /request access/i })).toBeNull();
      });
    });

    it('should show Request Access button for secured features', async () => {
      const result = createMockResult({ is_secured: true });
      const { getByRole, queryByRole } = renderComponent([result]);

      await waitFor(() => {
        expect(getByRole('button', { name: /request access/i })).toBeVisible();
        expect(queryByRole('button', { name: /download/i })).toBeNull();
      });
    });

    it('should show Secured chip for secured features', async () => {
      const result = createMockResult({ is_secured: true });
      const { getByText } = renderComponent([result]);

      await waitFor(() => {
        expect(getByText('Secured')).toBeVisible();
      });
    });

    it('should not show Secured chip for unsecured features', async () => {
      const result = createMockResult({ is_secured: false });
      const { queryByText } = renderComponent([result]);

      await waitFor(() => {
        expect(queryByText('Secured')).toBeNull();
      });
    });
  });

  describe('Button Actions', () => {
    it('should call onDownload when Download button clicked', async () => {
      const result = createMockResult({ is_secured: false });
      const { getByRole } = renderComponent([result]);

      await waitFor(() => {
        const downloadBtn = getByRole('button', { name: /download/i });
        fireEvent.click(downloadBtn);
      });

      expect(mockOnDownload).toHaveBeenCalledWith(result);
    });

    it('should call onAccessRequest when Request Access button clicked', async () => {
      const result = createMockResult({ is_secured: true });
      const { getByRole } = renderComponent([result]);

      await waitFor(() => {
        const requestBtn = getByRole('button', { name: /request access/i });
        fireEvent.click(requestBtn);
      });

      expect(mockOnAccessRequest).toHaveBeenCalledWith(result);
    });
  });
});
