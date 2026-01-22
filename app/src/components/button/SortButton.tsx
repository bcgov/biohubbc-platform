import { mdiArrowDown, mdiArrowUp, mdiFilterVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { ToggleButton, ToggleButtonProps } from '@mui/material';

interface SortButtonProps extends Omit<ToggleButtonProps, 'value'> {
  /** Sort direction */
  direction: 'asc' | 'desc';
  /** Whether this sort button is currently selected */
  selected?: boolean;
  /** Button label */
  children: React.ReactNode;
}

/**
 * Toggle-style button for sorting (asc/desc)
 */
export const SortButton = ({ direction, selected = false, children, ...props }: SortButtonProps) => {
  const iconPath = direction === 'asc' ? mdiArrowUp : mdiArrowDown;

  return (
    <ToggleButton
      {...props}
      value={direction}
      selected={selected}
      size="small"
      color="primary"
      sx={{
        border: 'none',
        borderRadius: 1,
        textTransform: 'none',
        minWidth: 60,
        fontWeight: 700,
        px: 1,
        display: 'flex',
        justifyContent: 'space-between',
        ...props.sx
      }}>
      {children}
      <Icon
        path={selected ? iconPath : mdiFilterVariant}
        size={0.8}
        style={{ marginLeft: '4px', opacity: selected ? 1 : 0.3 }}
      />
    </ToggleButton>
  );
};
