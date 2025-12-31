import Paper, { PaperProps } from '@mui/material/Paper';
import { Box } from '@mui/system';
import { PropsWithChildren } from 'react';

export interface PageHeaderProps extends PaperProps {
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Generic sticky page header wrapper
 * Provides Paper + spacing + sticky behavior
 */
export const PageHeader = ({ children, ...paperProps }: PropsWithChildren<PageHeaderProps>) => {
  return (
    <Paper
      square
      elevation={1}
      sx={{
        position: { sm: 'relative', lg: 'sticky' },
        top: 0,
        zIndex: 1002,
        boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.025)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        ...paperProps.sx
      }}
      {...paperProps}>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Paper>
  );
};
