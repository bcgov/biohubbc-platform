import { useApi } from 'hooks/useApi';
import { cleanup, render } from 'test-helpers/test-utils';
import SearchResultList, { ISearchResult } from './SearchResultList';

jest.mock('../../../hooks/useApi');

const mockBiohubApi = useApi as jest.Mock;
const mockBackToSearch = jest.fn();
const mockOnToggleDataVisibility = jest.fn();

const mockUseApi = {
  taxonomy: {
    searchSpecies: jest.fn()
  },
  search: {
    getSpatialData: jest.fn()
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
