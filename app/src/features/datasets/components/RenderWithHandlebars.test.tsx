//import { useApi } from 'hooks/useApi';
import { cleanup, render, screen } from 'test-helpers/test-utils';
import useHandlebars from 'utils/handlebarsUtils';
import RenderWithHandlebars from './RenderWithHandlebars';

jest.mock('utils/handlebarsUtils');

const mockHandlebars = useHandlebars as jest.Mock;

const HandlebarsComponent = () => {
  const content = {
    datasetEML: {
      data: {
        'eml:eml': {}
      }
    },
    rawTemplate: {}
  };

  return <RenderWithHandlebars datasetEML={content.datasetEML} rawTemplate={content.rawTemplate} />;
};

const mockHandlebarsImplementation = {
  compileFromRawTemplate: (dataset: any) => {
    return (dataset: any) => {
      return '<div>ABCD</div>';
    };
  }
};

describe('RenderWithHandlebars', () => {
  beforeEach(() => {
    mockHandlebars.mockImplementation(() => mockHandlebarsImplementation);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a component', () => {
    const { getByText } = render(<HandlebarsComponent />);

    expect(getByText('ABCD')).toBeVisible();
  });
});
