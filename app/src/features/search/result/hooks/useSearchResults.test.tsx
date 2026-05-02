import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useSearchQueryParams } from 'hooks/useSearchQuery';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { Mock, vi } from 'vitest';
import { useSearchResults } from './useSearchResults';

vi.mock('hooks/useApi');
vi.mock('hooks/useContext');
vi.mock('hooks/useSearchQuery', () => ({
  TypedURLSearchParams: URLSearchParams,
  useSearchQueryParams: vi.fn()
}));

const mockSearchFeatures = vi.fn();

describe('useSearchResults', () => {
  const expressionTree: ExpressionTreeExpression = {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 10,
        feature_type_property_id: null,
        operator: 'ILike',
        value: 'salmon'
      }
    ]
  };

  beforeEach(() => {
    mockSearchFeatures.mockResolvedValue({
      features: [],
      pagination: {
        total: 0,
        per_page: 25,
        current_page: 2,
        last_page: 1,
        sort: 'create_date',
        order: 'asc'
      }
    });

    (useApi as Mock).mockReturnValue({
      search: {
        searchFeatures: mockSearchFeatures
      }
    });

    (useDialogContext as Mock).mockReturnValue({
      setSnackbar: vi.fn()
    });

    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: new URLSearchParams('page=2&limit=25&sort=create_date&order=asc'),
      setSearchParams: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends the applied expression tree to the feature search endpoint hook', async () => {
    renderHook(() => useSearchResults('species_observation', true, expressionTree));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledWith('species_observation', expressionTree, {
        page: 2,
        limit: 25,
        sort: 'create_date',
        order: 'asc'
      });
    });
  });

  it('sends null expression with pagination when filters are cleared', async () => {
    renderHook(() => useSearchResults('species_observation', true, null));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledWith('species_observation', null, {
        page: 2,
        limit: 25,
        sort: 'create_date',
        order: 'asc'
      });
    });
  });

  it('uses pagination without explicit sort when no expression filters are applied', async () => {
    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: new URLSearchParams('page=3&limit=25'),
      setSearchParams: vi.fn()
    });

    renderHook(() => useSearchResults('species_observation', true, null));

    await waitFor(() => {
      expect(mockSearchFeatures).toHaveBeenCalledWith('species_observation', null, {
        page: 3,
        limit: 25,
        sort: undefined,
        order: undefined
      });
    });
  });

  it('removes a specific zero-valued query param', async () => {
    const setSearchParams = vi.fn();
    (useSearchQueryParams as Mock).mockReturnValue({
      searchParams: new URLSearchParams('species=0&species=123&page=2'),
      setSearchParams
    });

    const { result } = renderHook(() => useSearchResults('species_observation', true, null));

    await waitFor(() => expect(mockSearchFeatures).toHaveBeenCalled());

    act(() => {
      result.current.removeSearchParam('species', 0);
    });

    expect(setSearchParams).toHaveBeenCalledTimes(1);
    expect(setSearchParams.mock.calls[0][0].getAll('species')).toEqual(['123']);
    expect(setSearchParams.mock.calls[0][0].get('page')).toBe('1');
  });
});
