import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper, { PaperProps } from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useDialogContext } from 'hooks/useContext';
import { PropsWithChildren, ReactNode } from 'react';

const DESCRIPTION_PREVIEW_MAX_LENGTH = 300;

export interface PageHeaderProps extends PaperProps {
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  breadcrumbs?: ReactNode;
  label?: ReactNode;
  subheader?: ReactNode;
  description?: string | null;
  descriptionDialogTitle?: string;
  descriptionPreviewMaxLength?: number;
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
  description,
  descriptionDialogTitle = 'Description',
  descriptionPreviewMaxLength = DESCRIPTION_PREVIEW_MAX_LENGTH,
  tabs,
  buttons,
  ...paperProps
}: PropsWithChildren<PageHeaderProps>) => {
  const dialogContext = useDialogContext();
  const hasStructuredContent = Boolean(breadcrumbs || label || subheader || description || tabs || buttons);
  const isDescriptionTruncated = Boolean(description && description.length > descriptionPreviewMaxLength);
  const descriptionPreview =
    description && isDescriptionTruncated ? description.slice(0, descriptionPreviewMaxLength) : description;

  const handleReadMoreClick = () => {
    if (!description) {
      return;
    }

    dialogContext.setOkDialog({
      open: true,
      dialogTitle: descriptionDialogTitle,
      dialogText: '',
      dialogContent: <Typography sx={{ whiteSpace: 'pre-wrap' }}>{description}</Typography>,
      onClose: () => dialogContext.setOkDialog({ open: false })
    });
  };

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
              <Box mt={2.5}>
                {typeof subheader === 'string' ? (
                  <Typography color="text.secondary">{subheader}</Typography>
                ) : (
                  subheader
                )}
              </Box>
            )}
            {descriptionPreview && (
              <Typography
                color="text.secondary"
                component="div"
                mt={1.5}
                sx={{
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word'
                }}>
                {descriptionPreview}
                {isDescriptionTruncated ? (
                  <>
                    ...{' '}
                    <Box
                      component="span"
                      sx={{
                        fontWeight: 700,
                        color: 'primary.light',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        '&:hover': {
                          textDecoration: 'underline'
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={handleReadMoreClick}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleReadMoreClick();
                        }
                      }}>
                      read more
                    </Box>
                  </>
                ) : null}
              </Typography>
            )}
            {tabs && <Box mt={1.5}>{tabs}</Box>}
            {children && <Box mt={tabs || subheader || description ? 2 : 0}>{children}</Box>}
          </>
        ) : (
          <Box>{children}</Box>
        )}
      </Container>
    </Paper>
  );
};
