import { useTheme } from '@mui/material/styles';

export const useSearchFilterStyles = () => {
  const theme = useTheme();

  return {
    searchBoxContainer: {
      position: 'relative',
      background: '#ffffff',
      borderRadius: '4px',
      border: '1px solid #D8D8D8',
      padding: theme.spacing(1),
      transition: 'border-color 0.2s ease',
      '&:hover': {
        borderColor: '#898785'
      },
      '&:focus-within': {
        borderColor: '#2E5DD7',
        borderWidth: '2px',
        padding: `calc(${theme.spacing(1)} - 1px)` // Compensate for border width change
      }
    },
    searchInput: {
      height: '48px',
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      border: 'none',
      background: 'transparent'
    },
    // Clear button (circular X) inside search bar
    clearButton: {
      width: '28px',
      height: '28px',
      minWidth: '28px',
      borderRadius: '50%',
      color: '#697386',
      '&:hover': {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        color: '#292929'
      }
    },
    filterPillsContainer: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      paddingTop: theme.spacing(1.5),
      alignItems: 'center'
    },
    // Active filter pill
    activePill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 10px 6px 12px',
      background: '#F1F8FE',
      border: '1px solid #D4DEFF',
      borderRadius: '100px',
      fontSize: '14px',
      color: '#2E5DD7',
      fontWeight: 500
    },
    pillRemoveButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '18px',
      height: '18px',
      minWidth: '18px',
      borderRadius: '50%',
      background: 'transparent',
      border: 'none',
      color: '#2E5DD7',
      cursor: 'pointer',
      padding: 0,
      '&:hover': {
        background: 'rgba(59, 91, 219, 0.1)'
      }
    },
    // Draft filter pill (text input mode)
    draftPill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 6px 4px 12px',
      background: '#F1F8FE',
      border: '2px dashed #2E5DD7',
      borderRadius: '100px',
      fontSize: '14px',
      color: '#2E5DD7',
      fontWeight: 500
    },
    draftInput: {
      width: '120px',
      padding: '4px 8px',
      border: 'none',
      borderRadius: '4px',
      background: 'white',
      fontSize: '14px',
      color: '#1A1F36',
      '&:focus': {
        outline: 'none'
      }
    },
    draftConfirmButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      minWidth: '24px',
      borderRadius: '50%',
      background: '#2E5DD7',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      padding: 0,
      '&:hover': {
        background: '#1E5189'
      }
    },
    draftCancelButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      minWidth: '24px',
      borderRadius: '50%',
      background: '#8B95A5',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      padding: 0,
      '&:hover': {
        background: '#697386'
      }
    },
    // Draft filter pill (enum mode)
    enumOptions: {
      display: 'flex',
      gap: '4px'
    },
    enumOptionButton: {
      padding: '4px 10px',
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '4px',
      fontSize: '13px',
      color: '#374151',
      cursor: 'pointer',
      minWidth: 'auto',
      textTransform: 'none',
      '&:hover': {
        background: '#F3F4F6',
        borderColor: '#D1D5DB'
      }
    },
    // Add filter button - rounded to hint it creates a pill
    addFilterButton: {
      border: '1px dashed #C9CED6',
      borderRadius: '100px',
      padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
      color: '#697386',
      fontSize: '14px',
      textTransform: 'none',
      '&:hover': {
        borderColor: '#8B95A5',
        backgroundColor: '#F7F8FA'
      },
      '&.Mui-disabled': {
        border: '1px dashed #E5E7EB',
        color: '#C9CED6'
      }
    },
    filterMenu: {
      '& .MuiPaper-root': {
        borderRadius: '4px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        minWidth: '240px',
        maxHeight: '320px'
      }
    },
    menuSearchInput: {
      fontSize: '14px',
      padding: '8px 12px',
      background: '#F7F8FA',
      borderRadius: '4px',
      '& input::placeholder': {
        color: '#9CA3AF'
      }
    },
    filterMenuLabel: {
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: '#8B95A5',
      padding: theme.spacing(0.5, 1.5, 1)
    },
    filterMenuItem: {
      fontSize: '14px',
      padding: theme.spacing(1.25, 1.5),
      display: 'flex',
      justifyContent: 'space-between',
      '&:hover': {
        backgroundColor: '#F7F8FA'
      }
    },
    filterMenuItemType: {
      fontSize: '12px',
      color: '#9CA3AF'
    },

    // ==========================================================================
    // Filter Sidebar Styles
    // ==========================================================================

    // Main sidebar container
    filterSidebar: {
      width: '340px',
      minWidth: '340px',
      borderRight: '1px solid #D8D8D8',
      backgroundColor: '#FAFAFA',
      padding: theme.spacing(3),
      overflowY: 'auto'
    },

    // Sidebar header
    filterSidebarHeader: {
      fontSize: '13px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: '#464341',
      marginBottom: theme.spacing(1.5)
    },

    // Search input container
    filterSearchContainer: {
      marginBottom: theme.spacing(1)
    },

    // Search input
    filterSearchInput: {
      fontSize: '14px',
      padding: '8px 12px',
      background: '#F7F8FA',
      borderRadius: '4px',
      border: '1px solid transparent',
      '&:focus-within': {
        borderColor: '#2E5DD7',
        background: '#FFFFFF'
      },
      '& input::placeholder': {
        color: '#9CA3AF'
      }
    },

    // Container for filter groups
    filterGroupsContainer: {
      flex: 1,
      overflowY: 'auto'
    },

    // Group header (collapsible)
    filterGroupHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 0),
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '13px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: '#464341',
      '&:hover': {
        color: '#292929'
      }
    },

    // Clear filters button
    clearFiltersButton: {
      color: '#697386',
      fontSize: '14px',
      textTransform: 'none',
      '&:hover': {
        color: '#D8292F',
        backgroundColor: 'transparent'
      }
    },

    // ==========================================================================
    // Filter Checkbox Styles
    // ==========================================================================

    // Checkbox container
    filterCheckboxContainer: {
      padding: theme.spacing(0.5, 0)
    },

    // Value badge (shown when filter is active)
    filterValueBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      background: '#F1F8FE',
      border: '1px solid #D4DEFF',
      borderRadius: '4px',
      fontSize: '13px',
      color: '#2E5DD7'
    },

    // Value input container
    filterValueInputContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginLeft: theme.spacing(3.5),
      marginTop: theme.spacing(0.5)
    },

    // Value input field
    filterValueInput: {
      padding: '6px 8px',
      fontSize: '14px',
      border: '1px solid #D8D8D8',
      borderRadius: '4px',
      width: '140px',
      '&:focus-within': {
        borderColor: '#2E5DD7'
      }
    },

    // Confirm button for filter value
    filterConfirmButton: {
      width: '24px',
      height: '24px',
      minWidth: '24px',
      borderRadius: '50%',
      background: '#2E5DD7',
      color: 'white',
      '&:hover': {
        background: '#1E5189'
      }
    },

    // Cancel button for filter value
    filterCancelButton: {
      width: '24px',
      height: '24px',
      minWidth: '24px',
      borderRadius: '50%',
      background: '#8B95A5',
      color: 'white',
      '&:hover': {
        background: '#697386'
      }
    }
  };
};
