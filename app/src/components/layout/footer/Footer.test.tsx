import { ThemeProvider } from '@mui/styles';
import { render } from 'test-helpers/test-utils';
import appTheme from 'themes/appTheme';
import Footer from './Footer';

describe('Footer', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <ThemeProvider theme={appTheme}>
        <Footer />
      </ThemeProvider>
    );

    expect(getByText('Disclaimer')).toBeVisible();
    expect(getByText('Privacy')).toBeVisible();
    expect(getByText('Accessibility')).toBeVisible();
    expect(getByText('Copyright')).toBeVisible();
  });
});
