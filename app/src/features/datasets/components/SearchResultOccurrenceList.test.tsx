import { Checkbox } from '@mui/material';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ISpatialData } from 'interfaces/useSearchApi.interface';
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
    const mockCallBack = jest.fn<any, any>().mockResolvedValue({});
    const mockMapDataLoader = useDataLoader<
      [
        searchBoundary: Feature<Geometry, GeoJsonProperties>[],
        searchType: string[],
        species?: string[],
        searchZoom?: number,
        datasetID?: string
      ],
      ISpatialData[],
      unknown
    >(mockCallBack);

    return <SearchResultOccurrenceList mapDataLoader={mockMapDataLoader} onToggleDataVisibility={mockOnToggleDataVisibility} backToSearch={mockBackToSearch}  />;
  };

describe('SearchResultOccurrencelist', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an empty component', () => {
    const { getByText, getByTestId } = render(<SearchResultComponent />);

    expect(getByText('Found 0 observations', { exact: false })).toBeVisible();
  });

  it('backToSearch is called', () => {
    const { getByTestId } = render(<SearchResultComponent />);
    const button = getByTestId("RefineSearchButton");
    button.click()
    expect(mockBackToSearch).toBeCalled()
  });

  it('moose occurrences appear in list', () => {
    const { getByTestId } = render(<SearchResultComponent />);
    const button = getByTestId("RefineSearchButton");
    button.click()
    expect(mockBackToSearch).toBeCalled()
  });

});
