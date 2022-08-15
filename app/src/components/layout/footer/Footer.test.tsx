import { ThemeProvider } from '@mui/styles';
import { render } from 'test-helpers/test-utils';
import React from 'react';
import appTheme from 'themes/appTheme';
import Footer from './Footer';

describe('Footer', () => {
  it('renders correctly', () => {
    const { asFragment } = render(<ThemeProvider theme={appTheme}>
      
      <Footer />
    </ThemeProvider>
    );

    expect(asFragment()).toMatchSnapshot();
  });
});
