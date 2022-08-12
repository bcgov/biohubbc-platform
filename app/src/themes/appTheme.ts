import { createTheme } from '@mui/material/styles';
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
          src: local('BCSans'), local('BCSans-Regular'), url('./assets/fonts/BCSans/BCSans-Regular.woff') format('woff');
        }`
      ,
    },
    MuiTypography: {
      defaultProps: {
        fontFamily: 'BCSans'
      }
    }
  }
});

export default appTheme;
