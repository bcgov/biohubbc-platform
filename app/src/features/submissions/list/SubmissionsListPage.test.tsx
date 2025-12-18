import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { SearchFeatureResult } from 'interfaces/useSearchApi.interface';
import { MemoryRouter } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import SubmissionsListPage from './SubmissionsListPage';

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <SubmissionsListPage />
    </MemoryRouter>
  );

vi.mock('../../../hooks/useApi');

const mockUseApi = {
  search: {
    searchFeatures: vi.fn()
  },
  codes: {
    getAllCodeSets: vi.fn()
  }
};

const mockBiohubApi = useApi as Mock;

describe('SubmissionsListPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
    mockUseApi.codes.getAllCodeSets.mockResolvedValue({ feature_type_with_properties: [] });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Mounting', () => {
    it('should render page with search input', async () => {
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByText(/biohub bc/i)).toBeVisible();
        expect(actions.getByPlaceholderText(/search/i)).toBeVisible();
      });
    });

    it('should render empty state prompting to search', async () => {
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByText(/search to find data/i)).toBeVisible();
        expect(actions.getByText(/enter keywords, add filters, or both/i)).toBeVisible();
      });
    });
  });

  describe('Secure Access Request Dialog', () => {
    it('should mount with dialog closed', async () => {
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.queryByText(/secure data access request/i)).toBeNull();
      });
    });

    it('should open dialog on request access button click from search results', async () => {
      const mockResults: SearchFeatureResult[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Secured Feature',
          feature_description: null,
          submission_name: 'Test Submission',
          is_secured: true,
          relevancy_score: 0.85
        }
      ];
      mockUseApi.search.searchFeatures.mockResolvedValue(mockResults);
      const actions = renderPage();

      const searchInput = actions.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'test' } });

      await waitFor(
        () => {
          const requestAccessBtn = actions.getByRole('button', { name: /request access/i });
          expect(requestAccessBtn).toBeVisible();
          fireEvent.click(requestAccessBtn);
          expect(actions.getByText(/secure data access request/i)).toBeVisible();
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      mockUseApi.search.searchFeatures.mockReset();
    });

    it('should not trigger search API for input less than 3 characters', async () => {
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByPlaceholderText(/search/i)).toBeVisible();
      });

      const searchInput = actions.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'ab' } });

      // Wait a bit longer than debounce delay to ensure it wouldn't trigger
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(mockUseApi.search.searchFeatures).not.toHaveBeenCalled();
    });

    it('should trigger search API after 3+ characters and debounce delay', async () => {
      mockUseApi.search.searchFeatures.mockResolvedValue([]);
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByPlaceholderText(/search/i)).toBeVisible();
      });

      const searchInput = actions.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'moose' } });

      // Wait for debounce to complete
      await waitFor(
        () => {
          expect(mockUseApi.search.searchFeatures).toHaveBeenCalledWith({ keywords: 'moose' });
        },
        { timeout: 1000 }
      );
    });

    it('should display search results with feature information', async () => {
      const mockResults: SearchFeatureResult[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Moose Population Study',
          feature_description: 'A comprehensive study of moose populations',
          submission_name: 'Wildlife Survey 2024',
          is_secured: false,
          relevancy_score: 0.85
        }
      ];
      mockUseApi.search.searchFeatures.mockResolvedValue(mockResults);
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByPlaceholderText(/search/i)).toBeVisible();
      });

      const searchInput = actions.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'moose' } });

      await waitFor(
        () => {
          expect(actions.getByText('Moose Population Study')).toBeVisible();
          expect(actions.getByText(/dataset/i)).toBeVisible();
          expect(actions.getByText(/Wildlife Survey 2024/i)).toBeVisible();
          expect(actions.getByText('1 feature found')).toBeVisible();
        },
        { timeout: 1000 }
      );
    });

    it('should display secured indicator for secured features', async () => {
      const mockResults: SearchFeatureResult[] = [
        {
          submission_feature_id: 2,
          submission_id: 11,
          uuid: '550e8400-e29b-41d4-a716-446655440002',
          feature_type_id: 2,
          feature_type_name: 'observation',
          feature_name: 'Sensitive Species Observation',
          feature_description: null,
          submission_name: 'Protected Areas Survey',
          is_secured: true,
          relevancy_score: 0.7
        }
      ];
      mockUseApi.search.searchFeatures.mockResolvedValue(mockResults);
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByPlaceholderText(/search/i)).toBeVisible();
      });

      const searchInput = actions.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'sensitive' } });

      await waitFor(
        () => {
          expect(actions.getByText(/Secured/i)).toBeVisible();
        },
        { timeout: 1000 }
      );
    });

    it('should display empty results message when no features found', async () => {
      mockUseApi.search.searchFeatures.mockResolvedValue([]);
      const actions = renderPage();

      await waitFor(() => {
        expect(actions.getByPlaceholderText(/search/i)).toBeVisible();
      });

      const searchInput = actions.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(
        () => {
          expect(actions.getByText('No features found')).toBeVisible();
          expect(actions.getByText(/Try different keywords/i)).toBeVisible();
          expect(actions.getByText('0 features found')).toBeVisible();
        },
        { timeout: 1000 }
      );
    });

    it('should return to empty state when search cleared below 3 characters', async () => {
      mockUseApi.search.searchFeatures.mockResolvedValue([]);
      const actions = renderPage();

      // Wait for initial empty state
      await waitFor(() => {
        expect(actions.getByText(/search to find data/i)).toBeVisible();
      });

      // Enter search term
      const searchInput = actions.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'test' } });

      await waitFor(
        () => {
          expect(actions.getByText('0 features found')).toBeVisible();
        },
        { timeout: 1000 }
      );

      // Clear search below threshold
      fireEvent.change(searchInput, { target: { value: 'te' } });

      await waitFor(() => {
        expect(actions.getByText(/search to find data/i)).toBeVisible();
      });
    });
  });
});
