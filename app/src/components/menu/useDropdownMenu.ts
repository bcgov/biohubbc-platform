import { useMemo, useState } from 'react';
import type { IDropdownMenuItemGroup } from './DropdownMenu.interface';

/**
 * Shared state and derived values for controls that open a `DropdownMenu`.
 * Use this from trigger components that need selected labels, enabled-state checks, and menu anchor handlers.
 *
 * @param {string} value Currently selected item value.
 * @param {IDropdownMenuItemGroup[]} itemGroups Grouped menu items.
 * @param {(value: string) => void} onSelect Selection callback called after the menu closes.
 * @return {*}
 */
export const useDropdownMenu = (
  value: string,
  itemGroups: IDropdownMenuItemGroup[],
  onSelect: (value: string) => void
) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const flattenedItems = useMemo(() => itemGroups.flatMap((group) => group.items), [itemGroups]);
  const selectedItem = useMemo(() => flattenedItems.find((item) => item.value === value), [flattenedItems, value]);
  const selectedLabel = selectedItem?.label ?? value;
  const hasEnabledMenuItems = flattenedItems.some((item) => !item.disabled);

  const handleClose = () => setAnchorEl(null);
  const handleOpen = (element: HTMLElement) => setAnchorEl(element);
  const handleSelect = (nextValue: string) => {
    handleClose();
    onSelect(nextValue);
  };

  return {
    anchorEl,
    open,
    selectedItem,
    selectedLabel,
    hasEnabledMenuItems,
    handleClose,
    handleOpen,
    handleSelect
  };
};
