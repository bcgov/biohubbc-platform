import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { SYSTEM_ROLE } from 'constants/roles';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import {
  FormSubmissionUploadDecision,
  IFormSubmissionDetail,
  IFormVersionLayout
} from 'interfaces/useFormsApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import { buildUrl } from 'utils/Utils';
import { FormSubmissionCodesContent } from './content/FormSubmissionCodesContent';
import { FormSubmissionFilesContent } from './content/FormSubmissionFilesContent';
import { FormSubmissionFormContent } from './content/FormSubmissionFormContent';
import {
  FormSubmissionTab,
  IFormSubmissionRow,
  toFormSubmissionData,
  toFormSubmissionRows
} from './formSubmissionRows';

const FORM_SUBMISSION_TABS = new Set<FormSubmissionTab>(['form', 'codes', 'files']);

type FormSubmissionAction = 'save' | 'submit';

interface IFormSubmissionProps {
  /** Published version of the form. */
  layout: IFormVersionLayout;
  /** The form submission being edited or reviewed, or null for a new one. */
  detail: IFormSubmissionDetail | null;
}

/**
 * Form submission workspace, with one tab per part of a submission tarball: Form (the features), Codes (the
 * contributor's codesets) and Files (the media files). The workspace owns every part, so switching tabs keeps what was
 * entered; the selected tab is part of the address.
 *
 * A submitter saves the draft, which on first save starts the form submission, and submits it; editing after a submit
 * makes a revision to submit again. Saving and submitting require sign-in. Someone who only reviews the form submission
 * sees its latest submitted content read-only, and a form administrator approves or denies the latest submit.
 *
 * @param {IFormSubmissionProps} props
 * @returns {JSX.Element} Form submission tabs and the selected tab.
 */
export const FormSubmission = ({ layout, detail }: IFormSubmissionProps) => {
  const biohubApi = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();
  const authStateContext = useAuthStateContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as FormSubmissionTab | null;
  const activeTab = requestedTab && FORM_SUBMISSION_TABS.has(requestedTab) ? requestedTab : 'form';

  const slug = layout.form.slug;
  const isOwner = detail === null || detail.is_owner;
  const isSystemAdmin = Boolean(authStateContext.biohubUserWrapper.roleNames?.includes(SYSTEM_ROLE.SYSTEM_ADMIN));
  const canReview = Boolean(detail?.latest_upload) && (Boolean(detail?.is_form_admin) || isSystemAdmin);
  const reviewedData = detail?.latest_upload?.data ?? null;
  const savedData = isOwner ? (detail?.form_submission.data ?? null) : reviewedData;

  const [rowsByFeatureTypeId, setRowsByFeatureTypeId] = useState<Record<number, IFormSubmissionRow[]>>(() =>
    toFormSubmissionRows(layout.sections, savedData)
  );
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Report a failed request through the shared error dialog.
   *
   * @param {unknown} error_ The failure.
   * @param {string} title Dialog title.
   */
  const showError = (error_: unknown, title: string) => {
    const apiError = error_ as APIError;

    dialogContext.setErrorDialog({
      open: true,
      dialogTitle: title,
      dialogText: 'The request could not be completed. Your entries are still on this page.',
      dialogError: apiError.message,
      dialogErrorDetails: apiError.errors,
      onClose: () => dialogContext.setErrorDialog({ open: false }),
      onOk: () => dialogContext.setErrorDialog({ open: false })
    });
  };

  /**
   * Put a saved form submission in the query cache, refresh the submission list, and move to the form submission's
   * address when it was just started. The cache entry lets the page show it without reloading it.
   *
   * @param {IFormSubmissionDetail} result Saved form submission.
   */
  const applySavedFormSubmission = async (result: IFormSubmissionDetail) => {
    queryClient.setQueryData(formQueryKeys.submission(slug, result.form_submission.uuid), result);
    await queryClient.invalidateQueries({ queryKey: [...formQueryKeys.submissions(slug), 'list'] });

    if (detail === null) {
      navigate(`/forms/${slug}/submissions/${result.form_submission.uuid}`, { replace: true });
    }
  };

  /**
   * Save the draft, starting the form submission on first save, and submit it when asked. Signs in first when needed.
   *
   * @param {FormSubmissionAction} action Whether to submit after saving.
   */
  const handleAction = async (action: FormSubmissionAction) => {
    if (!authStateContext.auth.isAuthenticated) {
      authStateContext.auth.signinRedirect({ redirect_uri: buildUrl(window.location.origin, location.pathname) });
      return;
    }

    setIsSubmitting(true);

    try {
      const formSubmissionUuid =
        detail?.form_submission.uuid ?? (await biohubApi.forms.createFormSubmission(slug)).form_submission.uuid;
      let result = await biohubApi.forms.updateFormSubmission(
        slug,
        formSubmissionUuid,
        toFormSubmissionData(layout.sections, rowsByFeatureTypeId)
      );

      if (action === 'submit') {
        result = await biohubApi.forms.submitFormSubmission(slug, formSubmissionUuid);
      }

      await applySavedFormSubmission(result);
    } catch (error_) {
      showError(error_, action === 'submit' ? 'Error Submitting Form' : 'Error Saving Form');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Record a review decision on the latest submit.
   *
   * @param {FormSubmissionUploadDecision} decision Requested decision.
   */
  const handleDecision = async (decision: FormSubmissionUploadDecision) => {
    if (!detail?.latest_upload) {
      return;
    }

    setIsSubmitting(true);

    try {
      await biohubApi.forms.updateFormSubmissionUploadDecision(
        slug,
        detail.form_submission.uuid,
        detail.latest_upload.submission_upload_id,
        decision
      );
      await queryClient.invalidateQueries({ queryKey: formQueryKeys.submissions(slug) });
    } catch (error_) {
      showError(error_, 'Error Recording Decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  const latestUpload = detail?.latest_upload;
  const status = detail?.form_submission.status ?? 'draft';
  const subtitleParts = [status === 'draft' ? 'Draft' : 'Submitted'];

  if (latestUpload) {
    subtitleParts.push(`Latest submit: ${latestUpload.status}, ${latestUpload.decision}`);
  }

  if (layout.form_version.version_number > 1) {
    subtitleParts.push(`Revised form: version ${layout.form_version.version_number}`);
  }

  return (
    <AdminPageLayout
      title={layout.form.name}
      subtitle={subtitleParts.join(' · ')}
      description={layout.form.description}
      breadcrumbs={
        authStateContext.auth.isAuthenticated && (
          <Breadcrumbs aria-label="form breadcrumb">
            <Link component={RouterLink} to={`/forms/${slug}/submissions`} underline="hover" color="inherit">
              Submissions
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              {layout.form.name}
            </Typography>
          </Breadcrumbs>
        )
      }
      buttons={
        <Stack direction="row" gap={1}>
          {canReview && latestUpload?.decision === 'pending' && (
            <>
              <Button variant="outlined" color="error" disabled={isSubmitting} onClick={() => handleDecision('denied')}>
                Deny
              </Button>
              <Button variant="contained" disabled={isSubmitting} onClick={() => handleDecision('approved')}>
                Approve
              </Button>
            </>
          )}
          {isOwner && (
            <>
              <Button variant="outlined" disabled={isSubmitting} onClick={() => handleAction('save')}>
                Save draft
              </Button>
              <Button variant="contained" disabled={isSubmitting} onClick={() => handleAction('submit')}>
                Submit
              </Button>
            </>
          )}
        </Stack>
      }
      tabs={[
        { value: 'form', label: 'Form', id: 'form-submission-form', ariaControls: 'form-submission-panel' },
        { value: 'codes', label: 'Codes', id: 'form-submission-codes', ariaControls: 'form-submission-panel' },
        { value: 'files', label: 'Files', id: 'form-submission-files', ariaControls: 'form-submission-panel' }
      ]}
      activeTab={activeTab}
      onTabChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', value);
        setSearchParams(next);
      }}>
      <Box id="form-submission-panel" role="tabpanel" aria-labelledby={`form-submission-${activeTab}`}>
        {activeTab === 'form' && (
          <FormSubmissionFormContent
            slug={slug}
            sections={layout.sections}
            rowsByFeatureTypeId={rowsByFeatureTypeId}
            onRowsChange={(featureTypeId, rows) =>
              setRowsByFeatureTypeId((current) => ({ ...current, [featureTypeId]: rows }))
            }
            readOnly={!isOwner}
          />
        )}
        {activeTab === 'codes' && <FormSubmissionCodesContent slug={slug} />}
        {activeTab === 'files' && <FormSubmissionFilesContent files={files} onFilesChange={setFiles} />}
      </Box>
    </AdminPageLayout>
  );
};
