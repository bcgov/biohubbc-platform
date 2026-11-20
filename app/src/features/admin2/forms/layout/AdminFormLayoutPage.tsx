import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { useApi } from 'hooks/useApi';
import { useParams } from 'react-router-dom';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import { AdminFormLayoutEditor } from './AdminFormLayoutEditor';
import { EMPTY_FORM_LAYOUT, toFormLayout } from './formLayout';

/**
 * Form builder route. Without a version in the address it starts an empty form; with one it loads that version and
 * opens it in the builder. The builder is keyed by version so that moving to another version starts from its saved
 * layout.
 *
 * @returns {JSX.Element} Form builder, or its loading skeleton.
 */
export const AdminFormLayoutPage = () => {
  const biohubApi = useApi();
  const params = useParams<{ formId?: string; formVersionId?: string }>();
  const formId = Number(params.formId);
  const formVersionId = Number(params.formVersionId);
  const isExistingVersion = Boolean(params.formId && params.formVersionId);

  const formVersionQuery = useQuery({
    queryKey: formQueryKeys.version(formId, formVersionId),
    queryFn: ({ signal }) => biohubApi.forms.getFormVersion(formId, formVersionId, { signal }),
    enabled: isExistingVersion
  });

  if (!isExistingVersion) {
    return <AdminFormLayoutEditor key="create" initialLayout={EMPTY_FORM_LAYOUT} />;
  }

  if (!formVersionQuery.data) {
    return (
      <>
        <QueryErrorDialog error={formVersionQuery.error} label="form" />
        <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
          <Skeleton variant="text" width={300} height={48} sx={{ mb: 3 }} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Skeleton variant="rounded" height={480} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={240} />
            </Grid>
          </Grid>
        </Container>
      </>
    );
  }

  return <AdminFormLayoutEditor key={formVersionId} initialLayout={toFormLayout(formVersionQuery.data)} />;
};
