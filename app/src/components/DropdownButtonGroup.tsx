import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { IDropdownButtonGroupProps } from './DropdownButton.interface';
import { DropdownMenu, DropdownMenuIcon } from './menu/DropdownMenu';
import { useDropdownMenu } from './menu/useDropdownMenu';

/**
 * Split-button dropdown group with a primary action button and separate menu trigger.
 * Use when the current selection has a primary action, but alternate actions should stay available from a menu.
 * If `onPrimaryClick` is omitted, the primary button re-selects the current `value`.
 *
 * @param {IDropdownButtonGroupProps} props
 * @return {*}
 */
export const DropdownButtonGroup = (props: IDropdownButtonGroupProps) => {
  const { value, itemGroups, onSelect, primaryLabel, onPrimaryClick, size, ...buttonProps } = props;
  const { anchorEl, open, selectedLabel, hasEnabledMenuItems, handleClose, handleOpen, handleSelect } = useDropdownMenu(
    value,
    itemGroups,
    onSelect
  );
  const buttonLabel = primaryLabel ?? selectedLabel;

  return (
    <>
      <ButtonGroup variant="contained" size={size}>
        <Button
          {...buttonProps}
          onClick={() => {
            if (onPrimaryClick) {
              onPrimaryClick();
              return;
            }

            onSelect(value);
          }}>
          {buttonLabel}
        </Button>
        <Button
          {...buttonProps}
          disabled={!hasEnabledMenuItems}
          aria-label="open action menu"
          aria-haspopup="menu"
          aria-expanded={open ? 'true' : undefined}
          onClick={(event) => handleOpen(event.currentTarget)}
          sx={{ px: '6px !important', ...buttonProps.sx }}>
          <DropdownMenuIcon size={0.9} />
        </Button>
      </ButtonGroup>

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
