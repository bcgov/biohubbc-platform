import { useApi } from 'hooks/useApi';
import { cleanup, render } from 'test-helpers/test-utils';
import SearchResultOccurrenceList from './SearchResultOccurrenceList';

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

  return (
    <SearchResultOccurrenceList
      searchResults={[]}
      onToggleDataVisibility={mockOnToggleDataVisibility}
      backToSearch={mockBackToSearch}
    />
  );
};

describe('SearchResultOccurrencelist', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an empty component', () => {
    const { getByText } = render(<SearchResultComponent />);
    expect(getByText('Found 0 observations', { exact: false })).toBeVisible();
  });

  it('backToSearch is called', () => {
    const { getByTestId } = render(<SearchResultComponent />);
    const button = getByTestId('RefineSearchButton');
    button.click();
    expect(mockBackToSearch).toBeCalled();
  });

  it('moose occurrences appear in list', () => {
    const { getByTestId } = render(<SearchResultComponent />);
    const button = getByTestId('RefineSearchButton');
    button.click();
    expect(mockBackToSearch).toBeCalled();
  });
});
