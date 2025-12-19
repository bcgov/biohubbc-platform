import { mdiCheck, mdiClose } from '@mdi/js';
import { Icon } from '@mdi/react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import { useEffect, useRef, useState } from 'react';
import { IFilterCheckboxProps } from './types';
import { useSearchFilterStyles } from './useSearchFilterStyles';

/**
 * Individual filter checkbox with inline value input.
 * When checked, shows an input field for entering the filter value.
 *
 * @param {IFilterCheckboxProps} props
 * @returns {JSX.Element}
 */
export const FilterCheckbox = (props: IFilterCheckboxProps) => {
  const { displayName, type, isActive, value, onAdd, onRemove } = props;
  const styles = useSearchFilterStyles();

  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Update input value when external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      // Start editing mode to enter value
      setIsEditing(true);
      setInputValue('');
    } else {
      // Remove the filter
      onRemove();
      setIsEditing(false);
      setInputValue('');
    }
  };

  const handleConfirm = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim());
      setIsEditing(false);
    } else {
      // No value entered, cancel
      setIsEditing(false);
      setInputValue('');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Box sx={styles.filterCheckboxContainer}>
      <FormControlLabel
        control={
          <Checkbox
            checked={isActive || isEditing}
            onChange={handleCheckboxChange}
            size="small"
            sx={{
              color: '#697386',
              '&.Mui-checked': { color: '#2E5DD7' }
            }}
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', color: isActive ? '#2E5DD7' : '#292929' }}>{displayName}</span>
            {isActive && value && !isEditing && (
              <Box sx={styles.filterValueBadge}>
                {value}
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  sx={{ padding: '2px', marginLeft: '4px' }}
                  aria-label="Remove filter">
                  <Icon path={mdiClose} size={0.5} style={{ color: '#2E5DD7' }} />
                </IconButton>
              </Box>
            )}
          </Box>
        }
        sx={{ marginRight: 0, alignItems: 'flex-start' }}
      />

      {/* Inline value input */}
      {isEditing && (
        <Box sx={styles.filterValueInputContainer}>
          {type === 'datetime' ? (
            <input
              ref={inputRef}
              type="date"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                padding: '6px 8px',
                fontSize: '14px',
                border: '1px solid #D8D8D8',
                borderRadius: '4px',
                width: '140px'
              }}
            />
          ) : (
            <InputBase
              inputRef={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={type === 'number' ? 'Enter number...' : 'Enter value...'}
              type={type === 'number' ? 'number' : 'text'}
              sx={styles.filterValueInput}
            />
          )}
          <IconButton size="small" onClick={handleConfirm} sx={styles.filterConfirmButton} aria-label="Confirm">
            <Icon path={mdiCheck} size={0.6} />
          </IconButton>
          <IconButton size="small" onClick={handleCancel} sx={styles.filterCancelButton} aria-label="Cancel">
            <Icon path={mdiClose} size={0.5} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

export default FilterCheckbox;
