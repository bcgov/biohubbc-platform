import { mdiArrowTopRight } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';

export interface SearchSectionHeaderProps {
  label: string;
  onTitleClick?: () => void;
}

export const SearchSectionHeader = ({ label, onTitleClick }: SearchSectionHeaderProps) => {
  const isClickable = !!onTitleClick;

  const content = (
    <Typography
      component="span"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        color: grey[600],
        fontSize: 'inherit',
        fontWeight: 'inherit'
      }}>
      {label}
      {isClickable && <Icon path={mdiArrowTopRight} size={0.7} color={grey[600]} style={{ marginTop: '4px' }} />}
    </Typography>
  );

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
      {isClickable ? (
        <ButtonBase
          onClick={onTitleClick}
          sx={{
            borderRadius: 0,
            justifyContent: 'flex-start',
            padding: 0,
            borderBottom: '1px solid transparent',
            transition: 'border-bottom-color 0.2s ease',
            '&:hover': {
              borderBottomColor: grey[400]
            }
          }}>
          {content}
        </ButtonBase>
      ) : (
        content
      )}
    </Box>
  );
};
