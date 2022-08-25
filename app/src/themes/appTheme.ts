import { createTheme } from '@mui/material/styles';
import 'styles.scss';

const appTheme = createTheme({
  typography: {
    fontFamily: 'BCSans',
    h1: {
      fontSize: '2.25rem',
      fontWeight: 700
    },
    h2: {
      fontSize: '1.875rem',
      fontWeight: 700
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 700
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 700
    }
  },
  palette: {
    background: {
      default: '#f7f8fa'
    },
    primary: {
      main: '#036'
    },
    bcgovblue: {
      main: '#036',
      contrastText: '#fff'
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none'
        },
        sizeLarge: {
          fontSize: '1rem',
          fontWeight: 700
        }
      }
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          fontWeight: 700
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#1A5A96',
          textDecoration: 'none',
          textDecorationColor: '#1A5A96',
          ':hover': {
            textDecoration: 'underline'
          }
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: '700'
        }
      }
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '20px 24px'
        }
      }
    }
  }
});

declare module '@mui/material/styles' {
  interface Palette {
    bcgovblue: Palette['primary'];
  }

  // allow configuration using `createTheme`
  interface PaletteOptions {
    bcgovblue?: PaletteOptions['primary'];
  }
}

// Update the Button's color prop options
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    bcgovblue: true;
  }
}

export default appTheme;
