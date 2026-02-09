import { grey } from '@mui/material/colors';
import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';
import 'styles.scss';

const appTheme = createTheme({
  typography: {
    fontFamily: 'BCSans',
    h1: {
      fontSize: '1.875rem',
      fontWeight: 700
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 700
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 700
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 700
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 700
    }
  },
  palette: {
    background: {
      default: '#f5f5f5'
    },
    primary: {
      main: '#036'
    },
    bcgovblue: {
      main: '#036',
      contrastText: '#fff'
    },
    divider: '#f0f0f0'
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          overflowY: 'scroll'
        },
        a: {
          color: '#1a5a96',
          '&:focus': {
            outline: '2px solid #3B99FC',
            outlineOffset: '-1px',
            borderRadius: '4px'
          }
        },
        dl: {
          margin: 0
        },
        dd: {
          margin: 0
        },
        dt: {
          margin: 0
        },
        fieldset: {
          margin: 0,
          padding: 0,
          minWidth: 0,
          border: 'none'
        },
        legend: {
          '&.MuiTypography-root': {
            marginBottom: '15px',
            padding: 0,
            fontWeight: 700
          }
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          fontSize: '0.9rem',
          padding: '12px 20px'
        },
        icon: {
          marginRight: '1rem'
        }
      }
    },
    MuiIconButton: {
      defaultProps: {
        color: 'primary'
      }
    },
    MuiAlertTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          padding: '8px 24px',
          '&:focus': {
            outline: '2px solid #3B99FC',
            outlineOffset: '-1px'
          }
        },
        startIcon: {
          marginBottom: '1px'
        },
        sizeLarge: {
          fontSize: '1rem'
        },
        sizeSmall: {
          padding: '8px 12px',
          fontSize: '0.75rem'
        },
        containedPrimary: {
          fontWeight: 700,
          letterSpacing: '0.02rem'
        },
        containedError: {
          fontWeight: 700,
          letterSpacing: '0.02rem'
        },
        outlinedPrimary: {
          fontWeight: 700,
          letterSpacing: '0.02rem'
        }
      }
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true
      }
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          fontWeight: 700
        }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          padding: '4px 16px',
          '& .MuiListItemText-root': {
            margin: '4px'
          }
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#1A5A96',
          textDecoration: 'none',
          cursor: 'pointer',
          textDecorationColor: '#1A5A96',
          ':hover': {
            textDecoration: 'underline'
          }
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        size: 'medium'
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: '#f7f8fa',
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3B99FC'
          },
          padding: '4px 12px',
          fontSize: '0.875rem'
        },
        sizeSmall: {
          padding: '2px 12px',
          fontSize: '0.875rem'
        }
      }
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
            backgroundColor: '#f7f8fa',
            padding: '4px 12px',
            fontSize: '0.875rem',
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#3B99FC'
            }
          },
          '& .MuiAutocomplete-inputRoot': {
            padding: 0 // optional, adjust to match your input padding
          }
        }
      }
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '20px 24px'
        }
      }
    },
    MuiTable: {
      styleOverrides: {
        root: {
          '& th': {
            letterSpacing: '0.02rem',
            textTransform: 'uppercase'
          },
          '& tr:last-of-type td': {
            borderBottom: 'none'
          },
          '& .MuiLink-root': {
            fontFamily: 'inherit',
            fontSize: 'inherit'
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem'
        },
        head: {
          fontSize: '0.875rem',
          fontWeight: 700,
          color: grey[600]
        }
      }
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          backgroundColor: 'transparent',
          borderWidth: 0,
          width: '100%',
          overflowX: 'auto', // <— allow horizontal scroll
          '& .MuiDataGrid-columnHeaders': {
            fontSize: '0.875rem',
            fontWeight: 700,
            backgroundColor: 'transparent',
            color: grey[600]
          },
          '& .MuiDataGrid-columnHeader': {
            textTransform: 'uppercase',
            fontWeight: 700,
            letterSpacing: '0.02rem',
            backgroundColor: 'transparent',
            minWidth: 100
          },
          '& .MuiDataGrid-columnHeaderCheckbox': {
            minWidth: '75px !important'
          },
          '& .MuiDataGrid-row': {
            backgroundColor: 'transparent'
          },
          '& .MuiDataGrid-cell': {
            backgroundColor: 'transparent',
            padding: '0 4px'
          },
          '& .MuiDataGrid-cellCheckbox': {
            backgroundColor: 'transparent',
            minWidth: 75
          },
          '& .MuiLink-root': {
            fontFamily: 'inherit',
            fontSize: 'inherit'
          },
          '& .MuiDataGrid-cell:focus-within, & .MuiDataGrid-cellCheckbox:focus-within, & .MuiDataGrid-columnHeader:focus-within':
            {
              outline: 'none'
            },
          '& .MuiDataGrid-virtualScroller': {
            overflowX: 'auto' // <— ensure the virtual scroller also scrolls horizontally
          }
        }
      }
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          border: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          borderRadius: 0,
          gap: 1,
          '& .MuiToggleButton-root': {
            textTransform: 'none',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.875rem',
            padding: '6px 12px'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700
        },
        colorPrimary: {
          color: '#003366',
          backgroundColor: '#DCEBFB',
          textTransform: 'uppercase',
          fontSize: '12px',
          '&.colorSuccess': {
            color: '#2D4821',
            backgroundColor: '#DFF0D8'
          }
        },
        colorSecondary: {
          backgroundColor: 'red'
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 700
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          borderLeft: '16px solid #fff',
          borderRight: '16px solid #fff'
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
