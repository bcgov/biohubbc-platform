import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { Formik, FormikProps } from 'formik';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useRef } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import {
  CreateTagRuleFormInitialValues,
  getTagRuleFormValues,
  getTagRuleRequest,
  ITagRuleFormValues
} from '../form/tag-rule-form-values';
import { TagRuleForm } from '../form/TagRuleForm';
import { TagRuleYupSchema } from '../form/TagRuleYupSchema';
import { AdminTagRuleSkeleton } from './skeleton/AdminTagRuleSkeleton';

/**
 * Administrative tag rule page: creates a tag rule (`/admin/tag-rules/new`) or edits one
 * (`/admin/tag-rules/:tagRuleId`), then returns to the tag rules list.
 *
 * A failed save, such as a duplicate name, keeps the form and shows the server's error above it. A saved rule applies
 * only to tickets evaluated afterwards.
 *
 * @returns {JSX.Element} The tag rule page.
 */
export const AdminTagRulePage = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();
  const { tagRuleId } = useParams<{ tagRuleId: string }>();
  const formikRef = useRef<FormikProps<ITagRuleFormValues>>(null);

  const tagRuleQuery = useQuery({
    queryKey: tagQueryKeys.ruleDetail(tagRuleId ?? ''),
    queryFn: tagRuleId ? ({ signal }) => api.tagRules.getTagRule(tagRuleId, { signal }) : skipToken
  });
  const tagRule = tagRuleQuery.data;

  const saveTagRuleMutation = useMutation({
    mutationFn: (values: ITagRuleFormValues) => {
      const payload = getTagRuleRequest(values);

      if (tagRuleId) {
        return api.tagRules.updateTagRule(tagRuleId, payload);
      }

      return api.tagRules.createTagRule(payload);
    },
    onSuccess: (savedTagRule) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: tagRuleId ? `Updated tag rule ${savedTagRule.name}` : `Created tag rule ${savedTagRule.name}`
      });
      void refreshChangedQueries(queryClient, changedQueryKeys.tagRule());
      navigate('/admin/tag-rules');
    }
  });

  const isLoading = Boolean(tagRuleId) && !tagRule;
  const initialValues = tagRule ? getTagRuleFormValues(tagRule) : CreateTagRuleFormInitialValues;
  const pageTitle = tagRule?.name ?? 'New Tag Rule';

  const buttons = (
    <Stack gap={1} direction="row">
      <SecondaryButton disabled={saveTagRuleMutation.isPending} onClick={() => navigate('/admin/tag-rules')}>
        Cancel
      </SecondaryButton>
      <PrimaryButton
        loading={saveTagRuleMutation.isPending}
        disabled={isLoading}
        onClick={() => formikRef.current?.submitForm()}>
        {tagRuleId ? 'Save' : 'Create'}
      </PrimaryButton>
    </Stack>
  );

  return (
    <AdminPageLayout
      title={isLoading ? <Skeleton variant="text" width={240} /> : pageTitle}
      breadcrumbs={
        <Breadcrumbs aria-label="tag rule breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/tag-rules" underline="hover" color="inherit">
            Tag Rules
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            {isLoading ? 'Tag Rule' : pageTitle}
          </Typography>
        </Breadcrumbs>
      }
      buttons={buttons}
      tabs={[{ value: 'rule', label: 'Rule', id: 'tag-rule-tab', ariaControls: 'tag-rule-panel' }]}
      activeTab="rule"
      onTabChange={() => {}}>
      <Box id="tag-rule-panel" role="tabpanel" aria-labelledby="tag-rule-tab">
        <QueryErrorDialog error={tagRuleQuery.error} label="tag rule" />
        <LoadingGuard isLoading={isLoading} isLoadingFallback={<AdminTagRuleSkeleton />}>
          <Stack gap={3}>
            {saveTagRuleMutation.error ? <Alert severity="error">{saveTagRuleMutation.error.message}</Alert> : null}
            <Formik<ITagRuleFormValues>
              innerRef={formikRef}
              initialValues={initialValues}
              validationSchema={TagRuleYupSchema}
              validateOnBlur={false}
              validateOnChange={false}
              onSubmit={(values) => saveTagRuleMutation.mutate(values)}>
              <TagRuleForm />
            </Formik>
            <Stack direction="row" justifyContent="flex-end">
              {buttons}
            </Stack>
          </Stack>
        </LoadingGuard>
      </Box>
    </AdminPageLayout>
  );
};
