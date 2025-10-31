import { useApi } from 'hooks/useApi';
import { cleanup, render } from 'test-helpers/test-utils';
import SearchResultList, { ISearchResult } from './SearchResultList';
import { Mock } from 'vitest';

vi.mock('../../../hooks/useApi');

const mockBiohubApi = useApi as Mock;
const mockBackToSearch = vi.fn();
const mockOnToggleDataVisibility = vi.fn();

const mockUseApi = {
  taxonomy: {
    searchSpecies: vi.fn()
  },
  search: {
    getSpatialData: vi.fn()
  }
};

const SearchResultComponent = () => {
  const results: ISearchResult[] = [
    {
      key: 'TAXON-CODE',
      name: 'Species A',
      count: 1,
      visible: true
    }
  ];

  return (
    <SearchResultList
      searchResults={results}
      onToggleDataVisibility={mockOnToggleDataVisibility}
      backToSearch={mockBackToSearch}
    />
  );
};

describe('SearchResultList', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a component', () => {
    const { getByText } = render(<SearchResultComponent />);
    expect(getByText('Found 1 record', { exact: false })).toBeVisible();
  });

  it('backToSearch is called', () => {
    const { getByTestId } = render(<SearchResultComponent />);
    const button = getByTestId('RefineSearchButton');
    button.click();
    expect(mockBackToSearch).toBeCalled();
  });
});
