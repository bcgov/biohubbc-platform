import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper, { PaperProps } from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { PropsWithChildren, ReactNode } from 'react';

export interface PageHeaderProps extends PaperProps {
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  breadcrumbs?: ReactNode;
  label?: ReactNode;
  subheader?: ReactNode;
  tabs?: ReactNode;
  buttons?: ReactNode;
}

/**
 * Reusable page header wrapper with optional breadcrumbs, title, subheader, tabs, and right-side actions.
 *
 * Falls back to rendering children directly for legacy call sites.
 */
export const PageHeader = ({
  children,
  maxWidth = 'xl',
  breadcrumbs,
  label,
  subheader,
  tabs,
  buttons,
  ...paperProps
}: PropsWithChildren<PageHeaderProps>) => {
  const hasStructuredContent = Boolean(breadcrumbs || label || subheader || tabs || buttons);

  return (
    <Paper
      square
      elevation={0}
      sx={{
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
        borderColor: 'divider',
        ...paperProps.sx
      }}
      {...paperProps}>
      <Container
        maxWidth={maxWidth}
        sx={{
          py: 4,
          pb: tabs ? 0 : 4
        }}>
        {hasStructuredContent ? (
          <>
            {breadcrumbs && <Box mb={1.5}>{breadcrumbs}</Box>}
            {(label || buttons) && (
              <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                {typeof label === 'string' ? (
                  <Typography variant="h1" sx={{ ml: '-2px' }}>
                    {label}
                  </Typography>
                ) : (
                  label
                )}
                {buttons && <Box>{buttons}</Box>}
              </Box>
            )}
            {subheader && (
              <Box mt={1.5}>
                {typeof subheader === 'string' ? (
                  <Typography color="text.secondary">{subheader}</Typography>
                ) : (
                  subheader
                )}
              </Box>
            )}
            {tabs && <Box mt={1.5}>{tabs}</Box>}
            {children && <Box mt={tabs || subheader ? 2 : 0}>{children}</Box>}
          </>
        ) : (
          <Box>{children}</Box>
        )}
      </Container>
    </Paper>
  );
};
