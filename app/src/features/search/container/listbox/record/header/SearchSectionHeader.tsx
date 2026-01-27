import { mdiArrowTopRight } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';

export interface SearchSectionHeaderProps {
  label: string;
  onTitleClick?: () => void;
}

export const SearchSectionHeader = ({ label, onTitleClick }: SearchSectionHeaderProps) => {
  const isClickable = Boolean(onTitleClick);

  const headerContent = (
    <Box display="flex" alignItems="center" gap={0.5}>
      <Typography variant="subtitle2" color={grey[600]} component="span" sx={{ fontWeight: 500, lineHeight: 1 }}>
        {label}
      </Typography>
      {isClickable && <Icon path={mdiArrowTopRight} size={0.7} color={grey[600]} />}
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pt: 2,
        pb: 1,
        px: 2
      }}>
      {isClickable ? (
        <ButtonBase
          onClick={onTitleClick}
          sx={{
            p: 0,
            borderRadius: 0,
            justifyContent: 'flex-start',
            '&:hover': { borderBottom: `1px solid ${grey[400]}` },
            transition: 'border-bottom-color 0.2s ease'
          }}>
          {headerContent}
        </ButtonBase>
      ) : (
        headerContent
      )}
    </Box>
  );
};
