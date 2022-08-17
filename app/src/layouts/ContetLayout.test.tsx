import React from 'react';
import { render } from 'test-helpers/test-utils';
import ContentLayout from './ContentLayout';

describe('ContentLayout', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <ContentLayout>
        <p>This is the content layout test child component</p>
      </ContentLayout>
    );

    expect(getByText('This is the content layout test child component')).toBeVisible();
  });
});
