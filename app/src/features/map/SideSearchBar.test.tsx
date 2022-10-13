import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ISpatialData } from 'interfaces/useSearchApi.interface';
import { cleanup, render } from 'test-helpers/test-utils';
import SideSearchBar from './SideSearchBar';

jest.mock('../../hooks/useApi');

const mockBiohubApi = useApi as jest.Mock;

const mockUseApi = {
  taxonomy: {
    searchSpecies: jest.fn()
  }
};

describe('SideSearchBar', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });
  afterEach(() => {
    cleanup();
  });

  it('renders an empty component', () => {
    const TestComponent = () => {
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
      const mockAreaUpdate = jest.fn();
      const mockOnToggleDataVisibility = jest.fn();
      return (
        <SideSearchBar
          searchResults={[]}
          mapDataLoader={mockMapDataLoader}
          onAreaUpdate={mockAreaUpdate}
          onToggleDataVisibility={mockOnToggleDataVisibility}
        />
      );
    };

    const { getByText } = render(<TestComponent />);

    expect(getByText('What do you want to find?', { exact: false })).toBeVisible();
    expect(getByText('Refine Search Area', { exact: false })).toBeVisible();
    expect(getByText('Find Data', { exact: false })).toBeVisible();
  });
});
