import { mdiChevronDown } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import { IDropdownButtonProps } from './DropdownButton.interface';
import { DropdownMenu } from './menu/DropdownMenu';
import { useDropdownMenu } from './menu/useDropdownMenu';

/**
 * Single-button dropdown menu showing its children or the currently selected option label.
 * Use when choosing a value from grouped menu options is the only action.
 * The selected `value` controls the fallback button label and `onSelect` receives the next item value.
 *
 * @param {IDropdownButtonProps} props - Component props.
 * @returns {JSX.Element} Dropdown button.
 */
export const DropdownButton = (props: IDropdownButtonProps) => {
  const { value, children, itemGroups, onSelect, ...buttonProps } = props;
  const { anchorEl, open, selectedLabel, handleClose, handleOpen, handleSelect } = useDropdownMenu(
    value,
    itemGroups,
    onSelect
  );
  return (
    <>
      <Button
        variant="outlined"
        {...buttonProps}
        onClick={(event) => handleOpen(event.currentTarget)}
        endIcon={<Icon path={mdiChevronDown} size={0.8} />}
        sx={{
          justifyContent: 'space-between',
          textTransform: 'none',
          '&.Mui-disabled': {
            color: 'action.disabled',
            backgroundColor: 'action.disabledBackground',
            borderColor: 'action.disabledBackground'
          },
          ...buttonProps.sx
        }}>
        {children ?? selectedLabel}
      </Button>

      <DropdownMenu
        anchorEl={anchorEl}
        open={open}
        value={value}
        itemGroups={itemGroups}
        onClose={handleClose}
        onSelect={handleSelect}
      />
    </>
  );
};
