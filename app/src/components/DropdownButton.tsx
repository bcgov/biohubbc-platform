import { mdiMenuDown } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import { IDropdownButtonProps } from './DropdownButton.interface';
import { DropdownMenu } from './menu/DropdownMenu';
import { useDropdownMenu } from './menu/useDropdownMenu';

/**
 * Single-button dropdown menu showing the currently selected option label.
 * Use when choosing a value from grouped menu options is the only action.
 * The selected `value` controls the button label and `onSelect` receives the next item value.
 *
 * @param {IDropdownButtonProps} props
 * @return {*}
 */
export const DropdownButton = (props: IDropdownButtonProps) => {
  const { value, itemGroups, onSelect, valueColorMap, size = 'medium', ...buttonProps } = props;
  const { anchorEl, open, selectedLabel, handleClose, handleOpen, handleSelect } = useDropdownMenu(
    value,
    itemGroups,
    onSelect
  );
  const selectedColor = valueColorMap?.[value];

  return (
    <>
      <Button
        variant="outlined"
        size={size}
        {...buttonProps}
        color={selectedColor ?? buttonProps.color}
        onClick={(event) => handleOpen(event.currentTarget)}
        endIcon={<Icon path={mdiMenuDown} size={1} />}
        sx={{
          minWidth: size === 'small' ? 128 : 180,
          justifyContent: 'space-between',
          textTransform: 'none',
          backgroundColor: selectedColor ? `${selectedColor}.main` : 'grey.50',
          borderColor: selectedColor ? `${selectedColor}.main` : undefined,
          color: selectedColor ? `${selectedColor}.contrastText` : undefined,
          '&:hover': selectedColor
            ? {
                backgroundColor: `${selectedColor}.dark`,
                borderColor: `${selectedColor}.dark`
              }
            : undefined,
          '&.Mui-disabled': {
            color: 'action.disabled',
            backgroundColor: 'action.disabledBackground',
            borderColor: 'action.disabledBackground'
          },
          ...(size === 'small'
            ? {
                height: 34,
                px: 1.5,
                fontSize: 14
              }
            : null),
          ...buttonProps.sx
        }}>
        {selectedLabel}
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
