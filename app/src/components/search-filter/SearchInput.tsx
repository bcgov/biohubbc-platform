import { mdiClose, mdiMagnify } from '@mdi/js';
import { Icon } from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Input from '@mui/material/Input';
import InputAdornment from '@mui/material/InputAdornment';
import { ChangeEvent } from 'react';
import { useSearchFilterStyles } from './useSearchFilterStyles';

export interface ISearchInputProps {
  placeholderText: string;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  value: string;
  onClear?: () => void;
}

/**
 * Keyword search input component.
 * Displays a search box with magnifying glass icon and clear button.
 *
 * @param {ISearchInputProps} props
 * @returns {JSX.Element}
 */
export const SearchInput = (props: ISearchInputProps) => {
  const { placeholderText, handleChange, value, onClear } = props;
  const styles = useSearchFilterStyles();

  const handleClear = () => {
    onClear?.();
  };

  return (
    <Box sx={{ ...styles.searchBoxContainer }}>
      <Input
        tabIndex={0}
        sx={styles.searchInput}
        name="keywords"
        fullWidth
        disableUnderline
        startAdornment={
          <InputAdornment position="start">
            <Icon path={mdiMagnify} size={1} style={{ opacity: 0.5 }} />
          </InputAdornment>
        }
        endAdornment={
          value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClear} aria-label="Clear search" sx={styles.clearButton}>
                <Icon path={mdiClose} size={0.7} />
              </IconButton>
            </InputAdornment>
          ) : null
        }
        placeholder={placeholderText}
        onChange={handleChange}
        value={value}
      />
    </Box>
  );
};

export default SearchInput;
