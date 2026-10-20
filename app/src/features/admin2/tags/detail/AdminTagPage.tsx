import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { useApi } from 'hooks/useApi';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Navigate, Link as RouterLink, useParams } from 'react-router-dom';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { AdminTagRulesContent } from './content/AdminTagRulesContent';

/**
 * Administrative tag page: the tag's name and description, and the rules that apply the tag to tickets on its only
 * tab. The tag itself is edited from the tickets page's Tags tab.
 *
 * @returns {JSX.Element} The tag page.
 */
export const AdminTagPage = () => {
  const api = useApi();
  const { tagId } = useParams<{ tagId: string }>();

  const tagQuery = useQuery({
    queryKey: tagQueryKeys.detail(tagId ?? ''),
    queryFn: tagId ? ({ signal }) => api.tags.getTag(tagId, { signal }) : skipToken
  });

  if (!tagId) {
    return <Navigate to="/page-not-found" replace />;
  }

  const tag = tagQuery.data;

  return (
    <AdminPageLayout
      title={tag?.name ?? <Skeleton variant="text" width={240} />}
      description={tag?.description}
      descriptionDialogTitle="Tag description"
      breadcrumbs={
        <Breadcrumbs aria-label="tag breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/tickets" underline="hover" color="inherit">
            Tickets
          </Link>
          <Link component={RouterLink} to="/admin/tickets?tab=tags" underline="hover" color="inherit">
            Tags
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            {tag?.name ?? 'Tag'}
          </Typography>
        </Breadcrumbs>
      }
      tabs={[{ value: 'rules', label: 'Rules', id: 'tag-tab-rules', ariaControls: 'tag-panel' }]}
      activeTab="rules"
      onTabChange={() => {}}>
      <QueryErrorDialog error={tagQuery.error} label="tag" />
      <Box id="tag-panel" role="tabpanel" aria-labelledby="tag-tab-rules">
        <AdminTagRulesContent tagId={tagId} />
      </Box>
    </AdminPageLayout>
  );
};
