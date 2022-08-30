import { Feature } from 'geojson';
import { cleanup, render } from 'test-helpers/test-utils';
import SideSearchBar, { SideSearchBarProps } from './SideSearchBar';

const renderContainer = (props: SideSearchBarProps) => {
  return render(<SideSearchBar {...props} />);
};

describe('SideSearchBar', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders correctly', () => {
    const mockMapDataLoader = jest.fn();
    const mockAreaUpdate = jest.fn();

    let resolveRef: (value: unknown) => void;

    const mockDataLoaderPromise = new Promise(function (resolve: any, reject: any) {
      resolveRef = resolve;
      [(searchBoundary = null as unknown as Feature)];
    });

    const mockAreaUpdatePromise = new Promise(function (resolve: any, reject: any) {
      resolveRef = resolve;
    });

    const { getByText } = renderContainer({
      mapDataLoader: mockMapDataLoader.mockResolvedValue(mockDataLoaderPromise),
      onAreaUpdate: mockAreaUpdate.mockResolvedValue(mockAreaUpdatePromise)
      //onCancel: mockOnCancel
    });

    // const { getByText } = renderContainer(
    //   <Formik initialValues={DatasetSearchFormInitialValues} onSubmit={async () => {}}>
    //     <DatasetSearchForm
    //       onAreaUpdate={mockUpdateHandler.mockResolvedValue(mockUpdatePromise)}
    //       speciesList={[
    //         { value: 'M-ALAM', label: 'Moose (M-ALAM)' },
    //         { value: 'M-ORAM', label: 'Mountain Goat (M-ORAM)' },
    //         { value: 'M-OVDA', label: 'Thinhorn sheep (M-OVDA)' },
    //         { value: 'M-OVDA-DA', label: 'Thinhorn sheep (M-OVDA-DA)' },
    //         { value: 'M-OVDA-ST', label: 'Thinhorn sheep (M-OVDA-ST)' },
    //         { value: 'M-OVCA', label: 'Bighorn sheep (M-OVCA)' },
    //         { value: 'M-OVCA-CA', label: 'Bighorn sheep (M-OVCA-CA)' },
    //         { value: 'B-SPOW', label: 'Spotted Owl (B-SPOW)' },
    //         { value: 'B-SPOW-CA', label: 'Spotted Owl (B-SPOW-CA)' }
    //       ]}
    //     />
    //   </Formik>
    // );

    expect(getByText('label')).toBeVisible();
  });
});
