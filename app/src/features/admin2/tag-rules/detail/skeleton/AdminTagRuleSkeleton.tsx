import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Loading placeholder matching the tag rule form: the rule section's fields and the expression section.
 *
 * @returns {JSX.Element} The tag rule form skeleton.
 */
export const AdminTagRuleSkeleton = () => {
  return (
    <Stack gap={3} data-testid="tag-rule-skeleton">
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="text" width={120} height={40} />
        <Stack gap={2}>
          {[0, 1, 2].map((field) => (
            <Skeleton key={field} variant="rounded" height={56} />
          ))}
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="text" width="50%" />
        </Stack>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="text" width={120} height={40} />
        <Skeleton variant="rounded" height={120} />
      </Paper>
    </Stack>
  );
};
