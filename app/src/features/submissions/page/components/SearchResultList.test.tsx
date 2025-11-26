import { cleanup, render } from 'test-helpers/test-utils';
import SearchResultList, { ISearchResult } from './SearchResultList';

vi.mock('../../../hooks/useApi');

const mockBackToSearch = vi.fn();
const mockOnToggleDataVisibility = vi.fn();

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
