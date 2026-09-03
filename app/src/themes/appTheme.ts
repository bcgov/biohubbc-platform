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
        root: ({ theme }) => ({
          fontSize: '0.9rem',
          padding: '8px 16px',
          '&.MuiAlert-standard': {
            border: `1px solid ${alpha(theme.palette.primary.dark, 0.25)}`
          },
          '&.MuiAlert-standard.MuiAlert-colorError, &.MuiAlert-standardError': {
            borderColor: alpha(theme.palette.error.dark, 0.25)
          },
          '&.MuiAlert-standard.MuiAlert-colorInfo, &.MuiAlert-standardInfo': {
            borderColor: alpha(theme.palette.info.dark, 0.25)
          },
          '&.MuiAlert-standard.MuiAlert-colorSuccess, &.MuiAlert-standardSuccess': {
            borderColor: alpha(theme.palette.success.dark, 0.25)
          },
          '&.MuiAlert-standard.MuiAlert-colorWarning, &.MuiAlert-standardWarning': {
            borderColor: alpha(theme.palette.warning.dark, 0.25)
          }
        }),
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
          fontWeight: 700,
          fontSize: '0.9rem'
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        disableRipple: true
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
        contained: ({ theme, ownerState }) => {
          const { main, dark, contrastText } = {
            ...theme.palette.primary,
            ...(theme.palette[ownerState.color as keyof typeof theme.palette] as
              | { main: string; dark?: string; contrastText?: string }
              | undefined)
          };

          return {
            color: contrastText,
            backgroundColor: main,
            '&:hover': {
              backgroundColor: dark
            },
            '&.Mui-disabled': {
              color: theme.palette.action.disabled,
              backgroundColor: theme.palette.action.disabledBackground
            }
          };
        },
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
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 34,
          '& .MuiSvgIcon-root, & svg': {
            width: '1.25rem !important',
            height: '1.25rem !important',
            fontSize: '1.25rem'
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
    MuiBreadcrumbs: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
          lineHeight: 1.35,
          '& .MuiBreadcrumbs-ol': {
            alignItems: 'center',
            flexWrap: 'nowrap'
          },
          '& .MuiBreadcrumbs-li': {
            minWidth: 0
          },
          '& .MuiBreadcrumbs-li > *': {
            fontSize: '0.8125rem',
            lineHeight: 1.35,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }
        },
        li: {
          fontSize: 'inherit',
          lineHeight: 'inherit'
        },
        separator: {
          fontSize: '0.75rem',
          marginLeft: 6,
          marginRight: 6
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
            color: theme.palette.text.primary,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          },
          // Inputs default to single-line truncation (nowrap + ellipsis, above); reset the
          // multiline textarea back to native wrapping so typed text flows onto the next line.
          '& .MuiInputBase-inputMultiline': {
            whiteSpace: 'pre-wrap', // wrap long lines AND preserve user-entered newlines
            overflow: 'auto', // allow vertical scroll for fixed-`rows` textareas
            textOverflow: 'clip' // ellipsis is meaningless once text wraps
          },
          '& .MuiInputBase-input::placeholder': {
            color: theme.palette.text.secondary,
            opacity: 0.7,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          },
          '& .MuiInputAdornment-positionStart': {
            color: alpha(theme.palette.text.secondary, 0.5),
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
    MuiList: {
      styleOverrides: {
        root: { padding: 0 }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          padding: '8px'
        }
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
          color: theme.palette.text.primary,
          fontSize: '0.9rem'
        }),
        input: ({ theme }) => ({
          color: theme.palette.text.primary,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          '&::placeholder': {
            color: theme.palette.text.secondary,
            opacity: 0.7,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
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
          '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(0, 0, 0, 0.23)'
          },
          '&.Mui-disabled:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(0, 0, 0, 0.23)'
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
          display: 'block',
          maxWidth: 'calc(100% - 24px)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          '&.Mui-focused': {
            color: theme.palette.primary.main
          },
          '&.Mui-error': {
            color: theme.palette.error.main
          }
        })
      }
    },
    MuiDialog: {
      defaultProps: {
        fullWidth: true,
        maxWidth: 'md'
      },
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.palette.background.paper
        })
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(2.5, 3),
          fontWeight: 700,
          borderBottom: `1px solid ${theme.palette.divider}`
        })
      }
    },
    MuiDialogContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(3),
          '.MuiDialogTitle-root + &': {
            paddingTop: theme.spacing(3)
          }
        })
      }
    },
    MuiDialogContentText: {
      styleOverrides: {
        root: ({ theme }) => ({
          marginBottom: theme.spacing(2),
          color: theme.palette.text.primary,
          fontSize: '0.875rem',
          '&:last-child': {
            marginBottom: 0
          }
        })
      }
    },
    MuiDialogActions: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(2.5, 3),
          borderTop: `1px solid ${theme.palette.divider}`,
          justifyContent: 'flex-end'
        })
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
          '& .MuiLink-root': {
            fontFamily: 'inherit',
            fontSize: 'inherit'
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
            padding: '4px 10px'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minWidth: 0,
          maxWidth: '100%',
          padding: '0 4px',
          fontWeight: 700,
          '& .MuiChip-label': {
            fontWeight: 700,
            fontSize: '0.75rem',
            padding: '0 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          },
          '& .MuiChip-icon': {
            marginRight: theme.spacing(0.2)
          },
          '& .MuiChip-deleteIcon': {
            margin: '0 0 0 4px',
            color: alpha(theme.palette.text.secondary, 0.75),
            '&:hover': {
              color: theme.palette.text.primary
            }
          }
        }),
        outlined: {
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'currentColor'
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontWeight: 700,
          color: theme.palette.text.secondary,
          opacity: 0.8,
          textTransform: 'none',
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
