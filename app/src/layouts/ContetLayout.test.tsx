import { render } from '@testing-library/react';
import React from 'react';
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
