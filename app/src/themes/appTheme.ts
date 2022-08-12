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
          font-weight: 400;
          src: 
            local('BCSans'),
            url('./assets/fonts/BCSans/BCSans-Regular.woff2') format('woff2'),
            url('./assets/fonts/BCSans/BCSans-Regular.woff') format('woff')
            font-display: swap;
        }
        @font-face {
          font-family: 'BCSans';
          font-style: italic;
          src: 
            local('BCSans'),
            url('./assets/fonts/BCSans/BCSans-Italic.woff2') format('woff2'),
            url('./assets/fonts/BCSans/BCSans-Italic.woff') format('woff')
            font-display: swap;
        }
        @font-face {
          font-family: 'BCSans';
          font-weight: 700;
          src: 
            local('BCSans'),
            url('./assets/fonts/BCSans/BCSans-Bold.woff2') format('woff2'),
            url('./assets/fonts/BCSans/BCSans-Bold.woff') format('woff')
            font-display: swap;
        }
        @font-face {
          font-family: 'BCSans';
          font-style: italic;
          font-weight: 700;
          src: 
            local('BCSans'),
            url('./assets/fonts/BCSans/BCSans-BoldItalic.woff2') format('woff2'),
            url('./assets/fonts/BCSans/BCSans-BoldItalic.woff2') format('woff')
            font-display: swap;
        }
      `,
    },
    MuiTypography: {
      defaultProps: {
        // fontFamily: 'BCSans'
      }
    }
  }
});

export default appTheme;
