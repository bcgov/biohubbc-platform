import { mdiMenuDown } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useMemo, useState } from 'react';
import { IDropdownButtonGroupProps } from './DropdownButton.interface';

/**
 * Split-button dropdown group with a primary action button and separate menu trigger.
 *
 * @param {IDropdownButtonGroupProps} props
 * @return {*}
 */
export const DropdownButtonGroup = (props: IDropdownButtonGroupProps) => {
  const { value, itemGroups, onSelect, primaryLabel, onPrimaryClick, size, ...buttonProps } = props;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const flattenedItems = useMemo(() => itemGroups.flatMap((group) => group.items), [itemGroups]);
  const selectedItem = useMemo(() => flattenedItems.find((item) => item.value === value), [flattenedItems, value]);
  const selectedLabel = selectedItem?.label ?? value;
  const buttonLabel = primaryLabel ?? selectedLabel;
  const hasEnabledMenuItems = flattenedItems.some((item) => !item.disabled);
  const handleClose = () => setAnchorEl(null);
  const handleSelect = (nextValue: string) => {
    handleClose();
    onSelect(nextValue);
  };

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
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{ px: '6px !important', ...buttonProps.sx }}>
          <Icon path={mdiMenuDown} size={0.9} />
        </Button>
      </ButtonGroup>

      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {itemGroups.flatMap((group, groupIndex) => [
          ...group.items.map((item) => (
            <MenuItem
              key={`${group.groupId}-${item.value}`}
              selected={item.value === value}
              disabled={item.disabled}
              onClick={() => handleSelect(item.value)}>
              <ListItemIcon>
                <Icon path={item.iconPath} size={0.75} />
              </ListItemIcon>
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          )),
          ...(groupIndex < itemGroups.length - 1 ? [<Divider key={`${group.groupId}-divider`} />] : [])
        ])}
      </Menu>
    </>
  );
};
