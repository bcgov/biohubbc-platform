import { createTheme } from '@mui/material/styles';
import BCSansWoff from 'src/assets/fonts/BCSans/BCSans-Regular.woff'
import 'styles.scss';

const appTheme = createTheme({
  typography: {
    fontFamily: 'BCSans'
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @font-face {
          font-family: 'BCSans';
          font-style: normal;
          font-display: swap;
          font-weight: 400;
          src: local('BCSans'), local('BCSans-Regular'), url(${BCSansWoff}) format('woff');
        }
      `,
    }
  }
});

export default appTheme;
