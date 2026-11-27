import { skipToken, useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { Navigate, useParams } from 'react-router-dom';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import { FormSubmission } from './FormSubmission';

/**
 * Form submission route. Loads the published version of the form addressed by the slug in the address and, when the
 * address names one, the form submission being edited or reviewed; without one it starts a new form submission. A
 * public form opens for anyone; any other form opens only for members of its teams. An unknown or unpublished form, or
 * an unknown form submission, goes to the not found page, and one the user cannot access goes to the access denied
 * page.
 *
 * @returns {JSX.Element} Form submission page, its loading state, or a redirect.
 */
export const FormSubmissionPage = () => {
  const { slug, formSubmissionUuid } = useParams<{ slug: string; formSubmissionUuid?: string }>();
  const biohubApi = useApi();

  const formQuery = useQuery({
    queryKey: formQueryKeys.slug(slug ?? ''),
    queryFn: slug ? ({ signal }) => biohubApi.forms.getFormBySlug(slug, { signal }) : skipToken
  });
  const formSubmissionQuery = useQuery({
    queryKey: formQueryKeys.submission(slug ?? '', formSubmissionUuid ?? ''),
    queryFn:
      slug && formSubmissionUuid
        ? ({ signal }) => biohubApi.forms.getFormSubmission(slug, formSubmissionUuid, { signal })
        : skipToken
  });
  const apiError = (formQuery.error ?? formSubmissionQuery.error) as APIError | null;
  const isLoading = !formQuery.data || (Boolean(formSubmissionUuid) && !formSubmissionQuery.data);

  if (apiError?.status === 404) {
    return <Navigate to="/page-not-found" replace />;
  }

  if (apiError?.status === 403) {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <>
      <QueryErrorDialog error={formQuery.error ?? formSubmissionQuery.error} label="form" />
      <LoadingGuard isLoading={isLoading} isLoadingFallback={<SkeletonPage />}>
        {formQuery.data && !isLoading && (
          <FormSubmission
            key={formSubmissionUuid ?? 'new'}
            layout={formQuery.data}
            detail={formSubmissionQuery.data ?? null}
          />
        )}
      </LoadingGuard>
    </>
  );
};
