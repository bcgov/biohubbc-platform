import { render } from '@testing-library/react';
import React from 'react';
import BaseLayout from './BaseLayout';
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';

const history = createMemoryHistory();

describe('BaseLayout', () => {
  it('renders correctly', () => {
    process.env.REACT_APP_NODE_ENV = 'local';

    const { getByText } = render(
      <Router history={history}>
        <BaseLayout>
          <div>
            <p>The public layout content</p>
          </div>
        </BaseLayout>
      </Router>
    );

    expect(
      getByText('This is an unsupported browser. Some functionality may not work as expected.')
    ).toBeInTheDocument();
    expect(getByText('The public layout content')).toBeInTheDocument();
  });
});
