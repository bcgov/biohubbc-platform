import { mdiSquareMedium } from '@mdi/js';
import Icon from '@mdi/react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, BoxProps, Collapse, IconButton, Stack, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import React, { PropsWithChildren, useState } from 'react';

interface SubmissionUploadStatusSectionProps extends PropsWithChildren<BoxProps> {
  title: string;
  defaultExpanded?: boolean;
  startIcon?: React.ReactNode;
}

/**
 * Generic component for displaying information about a submission upload. Collapsible container with each
 * property rendered as its own row.
 *
 * @param {SubmissionUploadStatusSectionProps} props
 * @returns
 */
export const SubmissionUploadStatusSection = ({
  title,
  children,
  defaultExpanded,
  startIcon,
  ...boxProps
}: SubmissionUploadStatusSectionProps) => {
  const [expanded, setExpanded] = useState(!!defaultExpanded);

  const childrenArray = React.Children.toArray(children);
  const hasChildren = childrenArray.length > 0;

  const toggleExpanded = () => {
    if (hasChildren) {
      setExpanded((prev) => !prev);
    }
  };

  return (
    <Box {...boxProps}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          cursor: hasChildren ? 'pointer' : 'default',
          userSelect: 'none',
          position: 'relative'
        }}
        onClick={toggleExpanded}>
        <Box display="flex" alignItems="center" gap={1}>
          {startIcon ?? <Icon path={mdiSquareMedium} size={0.8} style={{ color: grey[400] }} />}

          <Typography variant="subtitle2" fontWeight={700} color="textSecondary">
            {title}{' '}
            <Typography variant="body2" component="span">
              ({childrenArray.length})
            </Typography>
          </Typography>
        </Box>

        {hasChildren && (
          <IconButton
            size="small"
            sx={{
              minHeight: 0,
              position: 'absolute',
              right: 0,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}>
            <KeyboardArrowDownIcon />
          </IconButton>
        )}
      </Box>

      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Stack gap={0} py={1} ml={3}>
            {childrenArray.map((child, index) => (
              <Box
                key={index}
                sx={{
                  px: 1,
                  py: 1,
                  borderRadius: 1,
                  bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent'
                }}>
                {child}
              </Box>
            ))}
          </Stack>
        </Collapse>
      )}
    </Box>
  );
};
