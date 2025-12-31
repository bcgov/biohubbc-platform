import { Box, ListItem, ListItemButton, ListItemProps, Typography } from '@mui/material';
import { ReactNode } from 'react';

export interface SearchOptionItemProps extends ListItemProps {
  name: string;
  description?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  onSelect: () => void;
}

export const SearchOptionItem = ({
  name,
  description,
  startIcon,
  endIcon,
  onSelect,
  ...listItemProps
}: SearchOptionItemProps) => {
  return (
    <ListItem disablePadding {...listItemProps}>
      <ListItemButton
        onClick={onSelect}
        sx={{
          px: 2,
          py: 1,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          '&:hover': { backgroundColor: 'action.hover' }
        }}>
        <Box sx={{ mr: 1 }}>{startIcon}</Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flex: 1,
            minWidth: 0
          }}>
          <Typography noWrap>{name}</Typography>

          {description && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {description}
            </Typography>
          )}
        </Box>

        {endIcon}
      </ListItemButton>
    </ListItem>
  );
};
