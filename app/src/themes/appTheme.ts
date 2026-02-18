import { grey } from '@mui/material/colors';
import { alpha, createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';
import 'styles.scss';

const BUTTON_BORDER_RADIUS = 4;

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
        root: ({ theme }) => ({
          borderRadius: BUTTON_BORDER_RADIUS,
          textTransform: 'none',
          fontWeight: 700,
          lineHeight: 1.2,
          minWidth: 60,
          '&.Mui-focusVisible': {
            outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`,
            outlineOffset: '2px'
          }
        }),
        startIcon: ({ theme }) => ({
          marginRight: theme.spacing(1),
          marginLeft: theme.spacing(-0.25),
          '& > *:nth-of-type(1)': {
            fontSize: '1.1rem'
          }
        }),
        endIcon: ({ theme }) => ({
          marginLeft: theme.spacing(1),
          marginRight: theme.spacing(-0.25),
          '& > *:nth-of-type(1)': {
            fontSize: '1.1rem'
          }
        }),
        sizeSmall: ({ theme }) => ({
          minHeight: 32,
          padding: theme.spacing(0.5, 1.5),
          fontSize: '0.8125rem',
          '& .MuiButton-startIcon > *:nth-of-type(1), & .MuiButton-endIcon > *:nth-of-type(1)': {
            fontSize: '1rem'
          }
        }),
        sizeMedium: ({ theme }) => ({
          minHeight: 40,
          padding: theme.spacing(1, 2.5),
          fontSize: '0.9375rem',
          '& .MuiButton-startIcon > *:nth-of-type(1), & .MuiButton-endIcon > *:nth-of-type(1)': {
            fontSize: '1.1rem'
          }
        }),
        sizeLarge: ({ theme }) => ({
          minHeight: 48,
          padding: theme.spacing(1.25, 3.5),
          fontSize: '1rem',
          '& .MuiButton-startIcon > *:nth-of-type(1), & .MuiButton-endIcon > *:nth-of-type(1)': {
            fontSize: '1.2rem'
          }
        }),
        contained: ({ theme }) => ({
          color: theme.palette.primary.contrastText,
          backgroundColor: theme.palette.primary.main,
          '&:hover': {
            backgroundColor: theme.palette.primary.dark
          },
          '&.Mui-disabled': {
            color: theme.palette.action.disabled,
            backgroundColor: theme.palette.action.disabledBackground
          }
        }),
        outlined: ({ theme }) => ({
          borderWidth: 1,
          borderColor: 'currentColor',
          '&:hover': {
            borderWidth: 1,
            borderColor: 'currentColor',
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.hoverOpacity)
          },
          '&.Mui-disabled': {
            color: theme.palette.action.disabled,
            borderColor: theme.palette.action.disabledBackground
          }
        }),
        text: ({ theme }) => ({
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.hoverOpacity)
          },
          '&.Mui-disabled': {
            color: theme.palette.action.disabled
          }
        })
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
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: '4px',
            padding: '8px 16px 8px 16px',
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            '& .MuiInputAdornment-root': {
              padding: 0
            },
            '& .MuiInputAdornment-positionStart': {
              marginLeft: 0,
              marginRight: '10px'
            },
            '& .MuiInputAdornment-positionEnd': {
              marginLeft: '10px',
              marginRight: 0
            },
            '&.MuiInputBase-sizeSmall': {
              padding: '6px 12px'
            },
            '&.MuiInputBase-sizeSmall .MuiInputBase-input': {
              padding: '6px 0'
            },
            '&.MuiInputBase-sizeSmall .MuiInputAdornment-positionStart': {
              marginRight: '8px'
            },
            '&.MuiInputBase-sizeSmall .MuiInputAdornment-positionEnd': {
              marginLeft: '8px'
            },
            '& fieldset': {
              border: `1px solid ${theme.palette.divider}`
            },
            '&:hover fieldset': {
              borderColor: theme.palette.text.secondary
            },
            '&.Mui-focused fieldset': {
              borderColor: theme.palette.primary.main,
              borderWidth: '2px'
            },
            '&.Mui-error input::placeholder': {
              color: theme.palette.error.main,
              opacity: 1
            }
          },
          '& .MuiInputBase-input': {
            padding: '8px 0',
            color: theme.palette.text.primary
          },
          '& .MuiInputBase-input::placeholder': {
            color: theme.palette.text.secondary,
            opacity: 0.7
          },
          '& .MuiInputAdornment-positionStart': {
            color: alpha(theme.palette.text.secondary, 0.78),
            '& .MuiSvgIcon-root, & svg': {
              color: 'inherit'
            }
          },
          '& .MuiFormLabel-root': {
            top: 1,
            left: 1
          },
          '& .MuiOutlinedInput-root.Mui-error .MuiInputAdornment-positionStart': {
            color: theme.palette.error.main
          },
          '& .MuiOutlinedInput-root.Mui-error .MuiInputAdornment-root': {
            color: theme.palette.error.main
          }
        })
      }
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: ({ theme }) => {
          const mode = theme.palette.mode;

          return {
            '&.MuiAutocomplete-hasPopupIcon .MuiOutlinedInput-root, &.MuiAutocomplete-hasClearIcon .MuiOutlinedInput-root':
              {
                paddingRight: '18px'
              },
            '& .MuiOutlinedInput-root': {
              borderRadius: '4px',
              padding: '8px 16px 8px 16px',
              '& .MuiAutocomplete-endAdornment': {
                paddingRight: '18px !important'
              },
              '& .MuiAutocomplete-popupIndicator, &.MuiAutocomplete-hasPopupIcon': {
                display: 'none'
              },
              '& .MuiFormLabel-root': {
                top: 1,
                left: 1
              }
            },
            '& .MuiInputBase-input': {
              padding: '8px 0px !important'
            },
            '& .MuiAutocomplete-tag': {
              backgroundColor: alpha(theme.palette.primary.main, mode === 'dark' ? 0.32 : 0.14),
              color: theme.palette.primary.dark,
              border: `1px solid ${alpha(theme.palette.primary.main, mode === 'dark' ? 0.6 : 0.3)}`,
              marginRight: '8px',
              '& .MuiChip-label': {
                color: theme.palette.primary.dark,
                fontWeight: 700
              },
              '& .MuiChip-deleteIcon': {
                fontSize: '1rem',
                color: alpha(theme.palette.primary.dark, 0.85),
                '&:hover': {
                  color: theme.palette.primary.dark
                }
              }
            }
          };
        }
      }
    },
    MuiInputBase: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.text.primary
        }),
        input: ({ theme }) => ({
          color: theme.palette.text.primary,
          '&::placeholder': {
            color: theme.palette.text.secondary,
            opacity: 0.7
          }
        })
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.divider
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.text.secondary
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.primary.main,
            borderWidth: '2px'
          }
        })
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.text.secondary,
          '&.Mui-focused': {
            color: theme.palette.primary.main
          },
          '&.Mui-error': {
            color: theme.palette.error.main
          }
        })
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
          overflowX: 'auto',
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
            overflowX: 'auto'
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
        root: ({ theme }) => ({
          fontWeight: 700,
          color: theme.palette.text.secondary,
          opacity: 0.75,
          padding: theme.spacing(0, 2),
          '&.Mui-selected': {
            color: theme.palette.primary.main,
            opacity: 1
          }
        })
      }
    },
    MuiTabs: {
      styleOverrides: {
        indicator: ({ theme }) => ({
          height: 3,
          backgroundColor: theme.palette.primary.main
        })
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
