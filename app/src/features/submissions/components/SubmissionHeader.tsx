import Breadcrumbs from '@mui/material/Breadcrumbs';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BaseHeader from 'components/layout/header/BaseHeader';
import PublishSecurityReviewButton from 'features/submissions/components/PublishSecurityReview/PublishSecurityReviewButton';
import SubmissionHeaderSecurityStatus from 'features/submissions/components/SubmissionHeaderSecurityStatus';
import { useApi } from 'hooks/useApi';
import { useSubmissionContext } from 'hooks/useSubmissionContext';
import { Link as RouterLink } from 'react-router-dom';

export interface ISubmissionHeaderProps {
  selectedFeatures: number[];
}

/**
 * Checks if security has been applied to all features in a submission.
 *
 * @param {IGetSubmissionResponse} submission
 * @return {*}  {SECURITY_APPLIED_STATUS}
 */
export const checkSubmissionSecurity = (submission: IGetSubmissionResponse): SECURITY_APPLIED_STATUS => {
  let securityCount = 0;
  let featureCount = 0;

  submission.features?.observations.forEach((observation: IFeature) => {
    if (
      observation.data?.submission_feature_security_ids &&
      observation.data?.submission_feature_security_ids.length > 0
    ) {
      securityCount += 1;
    }
    featureCount += 1;
  });

  submission.features?.animals.forEach((animal: IFeature) => {
    if (animal.data?.submission_feature_security_ids && animal.data?.submission_feature_security_ids.length > 0) {
      securityCount += 1;
    }
    featureCount += 1;
  });

  submission.features?.sampleSites.forEach((sampleSite: IFeature) => {
    if (
      sampleSite.data?.submission_feature_security_ids &&
      sampleSite.data?.submission_feature_security_ids.length > 0
    ) {
      securityCount += 1;
    }
    featureCount += 1;
  });

  if (securityCount === 0) {
    return SECURITY_APPLIED_STATUS.UNSECURED;
  }

  if (securityCount === featureCount) {
    return SECURITY_APPLIED_STATUS.SECURED;
  }

  return SECURITY_APPLIED_STATUS.PARTIALLY_SECURED;
};

/**
 * Submission header for admin single-submission view.
 *
 * @return {*}
 */
const SubmissionHeader = (props: ISubmissionHeaderProps) => {
  const submissionContext = useSubmissionContext();

  const api = useApi();

  const submissionUUID = submissionContext.submissionDataLoader.data?.submission.uuid;
  const submissionDataLoader = submissionContext.submissionDataLoader;

  if (!submissionDataLoader.data) {
    return <CircularProgress className="pageProgress" size={40} />;
  }

  const secure = checkSubmissionSecurity(submissionDataLoader.data);

  const submission = submissionDataLoader.data?.submission;
  const features = submissionDataLoader.data?.features;
  const dataset = features.dataset[0];

  const onSecurityReviewComplete = async () => {
    await api.submissions.updateSubmissionRecord(submissionContext.submissionId, { security_reviewed: true });
    submissionContext.submissionDataLoader.refresh(submissionContext.submissionId);
  };

  const onSecurityReviewRemove = async () => {
    await api.submissions.updateSubmissionRecord(submissionContext.submissionId, { security_reviewed: false });
    submissionContext.submissionDataLoader.refresh(submissionContext.submissionId);
  };

  return (
    <>
      <BaseHeader
        title={dataset?.data.name}
        breadCrumb={
          <Breadcrumbs>
            <Link component={RouterLink} variant="body2" underline="hover" to={`/admin/dashboard`} aria-current="page">
              Dashboard
            </Link>
            <Typography variant="body2" component="span">
              {dataset?.data.name}
            </Typography>
          </Breadcrumbs>
        }
        subTitle={
          <Stack flexDirection="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
            <SubmissionHeaderSecurityStatus submission={submission} />
          </Stack>
        }
        buttonJSX={
          <Stack flexDirection="row" alignItems="center" gap={1}>
            {/* <ManageSecurity features={props.selectedFeatures} /> */}

            <PublishSecurityReviewButton
              submission={submission}
              onComplete={onSecurityReviewComplete}
              onRemove={onSecurityReviewRemove}
            />
          </Stack>
        }
      />
    </>
  );
};

export default SubmissionHeader;
