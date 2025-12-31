import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Checkbox, IconButton, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { grey } from '@mui/material/colors';
import { ChangeEvent } from 'react';

export interface SidebarOption {
  label: string;
  value: string | number;
}

export interface SearchSidebarOptionProps {
  option: SidebarOption;
  checkbox?: boolean;
  selected?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  onClick?: () => void;
  onRemove?: () => void;
  recommended?: boolean;
}

export const SearchSidebarOption = ({
  option,
  checkbox = false,
  selected = false,
  onCheckboxChange,
  onClick,
  onRemove,
  recommended = false
}: SearchSidebarOptionProps) => {
  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    onCheckboxChange?.(e.target.checked);
  };

  return (
    <ListItem disablePadding>
      <ListItemButton
        selected={selected}
        onClick={onClick}
        sx={{
          border: recommended ? '1.75px dashed' : '1.75px solid transparent',
          borderColor: recommended ? grey[400] : 'transparent',
          borderRadius: 1,
          bgcolor: '#fff',
          mb: 0.5,
          py: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          '&:hover': {
            bgcolor: recommended ? grey[50] : grey[100]
          }
        }}>
        <Box display="flex" alignItems="center" gap={1} flex="1">
          {checkbox && (
            <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple onChange={handleCheckboxChange} />
          )}
          <ListItemText
            primary={option.label}
            primaryTypographyProps={{
              fontSize: '0.8rem',
              color: recommended ? 'textSecondary' : 'textPrimary'
            }}
          />
        </Box>

        {onRemove && (
          <IconButton
            size="small"
            sx={{ color: grey[400] }}
            edge="end"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}>
            <Icon path={mdiClose} size={0.75} />
          </IconButton>
        )}
      </ListItemButton>
    </ListItem>
  );
};
