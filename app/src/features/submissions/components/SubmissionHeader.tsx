import { mdiChevronDown, mdiCog, mdiLock, mdiLockAlertOutline, mdiLockOpenVariantOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BaseHeader from 'components/layout/header/BaseHeader';
import { SubmissionContext } from 'contexts/submissionContext';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import { IFeature, IGetSubmissionResponse } from 'interfaces/useSubmissionsApi.interface';
import moment from 'moment';
import React, { useContext, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export interface ISubmissionHeaderProps {
  openSecureRecordsDialog: (open: boolean) => void;
  openCompleteReviewDialog: (open: boolean) => void;
  openUnsecureRecordsDialog: (open: boolean) => void;
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
  const submissionContext = useContext(SubmissionContext);

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);

  const submissionDataLoader = submissionContext.submissionDataLoader;

  if (!submissionDataLoader.data) {
    return <CircularProgress className="pageProgress" size={40} />;
  }

  const secure = checkSubmissionSecurity(submissionDataLoader.data);

  const submission = submissionDataLoader.data?.submission;
  const features = submissionDataLoader.data?.features;
  const dataset = features.dataset[0];

  return (
    <>
      <BaseHeader
        title={dataset?.data.name}
        breadCrumb={
          <Breadcrumbs>
            <Link component={RouterLink} variant="body2" underline="hover" to={`/admin/dashboard`} aria-current="page">
              DASHBOARD
            </Link>
            <Typography variant="body2" component="span">
              {dataset?.data.name}
            </Typography>
          </Breadcrumbs>
        }
        subTitle={
          <Stack flexDirection="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
            <Stack flexDirection="row" alignItems="center">
              {submission?.security_review_timestamp ? (
                <>
                  {secure === SECURITY_APPLIED_STATUS.SECURED && (
                    <>
                      <Icon path={mdiLock} size={1} />
                      <Typography component="span" color="textSecondary" sx={{ ml: 1 }}>
                        SECURED ·
                      </Typography>
                    </>
                  )}
                  {secure === SECURITY_APPLIED_STATUS.UNSECURED && (
                    <>
                      <Icon path={mdiLockOpenVariantOutline} size={1} />
                      <Typography component="span" color="textSecondary" sx={{ ml: 1 }}>
                        UNSECURED ·
                      </Typography>
                    </>
                  )}
                  {secure === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED && (
                    <>
                      <Icon path={mdiLockAlertOutline} size={1} />
                      <Typography component="span" color="textSecondary" sx={{ ml: 1 }}>
                        PARTIALLY SECURED ·
                      </Typography>
                    </>
                  )}
                  <Typography component="span" color="textSecondary" sx={{ ml: 1 }}>
                    PUBLISHED: {moment(submission?.security_review_timestamp).format('YYYY-MM-DD')}
                  </Typography>
                </>
              ) : (
                <>
                  {secure === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED && (
                    <>
                      <Icon path={mdiLockAlertOutline} size={1} />
                      <Typography component="span" color="textSecondary" sx={{ ml: 1 }}>
                        PARTIALLY SECURED ·
                      </Typography>
                    </>
                  )}
                  <Typography component="span" color="textSecondary" sx={{ ml: 1 }}>
                    PENDING REVIEW · SUBMITTED: {moment(submission?.create_date).format('YYYY-MM-DD')} by{' '}
                    {submission?.create_user}
                  </Typography>
                </>
              )}
            </Stack>
          </Stack>
        }
        buttonJSX={
          <>
            <Stack flexDirection="row" alignItems="center" gap={1}>
              <Button
                id="submission_settings_button"
                aria-label="Submission Settings"
                aria-controls="submissionSettingsMenu"
                aria-haspopup="true"
                variant="outlined"
                color="primary"
                data-testid="settings-submission-button"
                startIcon={<Icon path={mdiCog} size={1} />}
                endIcon={<Icon path={mdiChevronDown} size={1} />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => setMenuAnchorEl(event.currentTarget)}>
                MANAGE SECURITY
              </Button>

              <Button variant="contained" color="primary" onClick={() => props.openCompleteReviewDialog(true)}>
                COMPLETE REVIEW
              </Button>
            </Stack>

            <Menu
              id="submissionSettingsMenu"
              aria-labelledby="submission_settings_button"
              style={{ marginTop: '8px' }}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right'
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right'
              }}
              keepMounted
              anchorEl={menuAnchorEl}
              open={Boolean(menuAnchorEl)}
              onClose={() => setMenuAnchorEl(null)}>
              <MenuItem onClick={() => props.openSecureRecordsDialog(true)}>
                <ListItemIcon>
                  <Icon path={mdiLock} size={1} />
                </ListItemIcon>
                <Typography variant="inherit">Secure Records</Typography>
              </MenuItem>
              <MenuItem onClick={() => props.openUnsecureRecordsDialog(true)}>
                <ListItemIcon>
                  <Icon path={mdiLockOpenVariantOutline} size={1} />
                </ListItemIcon>
                <Typography variant="inherit">Unsecure Records</Typography>
              </MenuItem>
            </Menu>
          </>
        }
      />
    </>
  );
};

export default SubmissionHeader;
