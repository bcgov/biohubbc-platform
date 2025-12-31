import { mdiArrowTopRight } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Button, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';

export interface SearchSectionHeaderProps {
  label: string;
  onTitleClick?: () => void;
}

export const SearchSectionHeader = ({ label, onTitleClick }: SearchSectionHeaderProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pb: 1,
        pt: 2,
        px: 2
      }}>
      {onTitleClick ? (
        <Button
          onClick={onTitleClick}
          sx={{
            display: 'flex',
            borderRadius: 0,
            alignItems: 'center',
            gap: 0.5,
            padding: 0,
            minWidth: 'auto',
            textTransform: 'none',
            fontSize: 'inherit',
            color: grey[400],
            fontWeight: 'inherit',
            justifyContent: 'flex-start',
            borderBottom: '1px solid transparent',
            transition: 'border-bottom-color 0.2s ease',
            '&:hover': {
              borderBottomColor: 'inherit',
              backgroundColor: 'transparent'
            }
          }}>
          <Typography component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} color="textSecondary">
            {label}
            <Icon path={mdiArrowTopRight} size={0.7} color={grey[500]} style={{ marginTop: '4px' }} />
          </Typography>
        </Button>
      ) : (
        <Typography>{label}</Typography>
      )}
    </Box>
  );
};
