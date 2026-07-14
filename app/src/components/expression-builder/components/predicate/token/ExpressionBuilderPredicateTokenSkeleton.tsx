import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { IconButton, Skeleton, Stack } from '@mui/material';
import { ExpressionBuilderPredicateTokenSkeletonProps } from './ExpressionBuilderPredicateToken.interface';

/**
 * Renders a predicate-token skeleton while selected property metadata is resolving.
 *
 * Use this as the loading fallback for predicate rows that already have selected
 * property ids but do not yet have property metadata available for the label,
 * operators, and value editor.
 *
 * @param {ExpressionBuilderPredicateTokenSkeletonProps} props - Remove handler for the unresolved predicate row.
 * @returns {JSX.Element} Skeleton matching the compact predicate token footprint.
 */
export const ExpressionBuilderPredicateTokenSkeleton = ({ onRemove }: ExpressionBuilderPredicateTokenSkeletonProps) => (
  <Stack
    data-testid="expression-filter-token"
    direction="row"
    gap={1}
    alignItems="center"
    flexWrap="nowrap"
    sx={{
      bgcolor: 'action.hover',
      borderRadius: 1,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      flex: '1 1 520px',
      minWidth: 0,
      px: 1,
      py: 1
    }}>
    <DragIndicatorIcon
      fontSize="small"
      sx={{
        color: 'text.secondary'
      }}
    />
    <Skeleton variant="rounded" height={36} sx={{ flex: '1.25 1 220px', minWidth: 0 }} />
    <Skeleton variant="rounded" height={36} sx={{ flex: '1 1 180px', minWidth: 0 }} />
    <Skeleton variant="rounded" height={36} sx={{ flex: '1 1 180px', minWidth: 0 }} />
    <IconButton aria-label="Remove filter" size="small" onClick={onRemove} color="inherit" sx={{ flexShrink: 0 }}>
      <Icon path={mdiTrashCanOutline} size={0.6} />
    </IconButton>
  </Stack>
);
