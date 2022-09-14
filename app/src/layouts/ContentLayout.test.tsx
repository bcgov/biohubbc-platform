import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import ContentLayout from './ContentLayout';

const history = createMemoryHistory();

describe('ContentLayout', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <Router history={history}>
        <ContentLayout>
          <p>This is the content layout test child component</p>
        </ContentLayout>
      </Router>
    );

    expect(getByText('This is the content layout test child component')).toBeVisible();
  });
});
