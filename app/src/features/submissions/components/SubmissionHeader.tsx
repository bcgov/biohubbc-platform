import { mdiChevronDown, mdiCog, mdiLock, mdiLockOpen, mdiPencil } from '@mdi/js';
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
import React, { useContext, useState } from 'react';
import { useHistory } from 'react-router';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Submission header for a single-submission view.
 *
 * @return {*}
 */
const SubmissionHeader = () => {
  const history = useHistory();
  const submissionContext = useContext(SubmissionContext);

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);

  const submissionUUID = submissionContext.submissionUUID;
  const submissionDataLoader = submissionContext.submissionDataLoader;

  const submissionData = submissionDataLoader.data;
  console.log('submissionData', submissionData);

  if (!submissionDataLoader.data) {
    return <CircularProgress className="pageProgress" size={40} />;
  }

  const submission = submissionDataLoader.data?.submission;
  const features = submissionDataLoader.data?.features;
  console.log('features', features);
  const dataset = features?.dataset[0];
  console.log('dataset', dataset);

  return (
    <>
      <BaseHeader
        title={dataset?.data.name}
        breadCrumb={
          <Breadcrumbs>
            <Link
              component={RouterLink}
              variant="body2"
              underline="hover"
              to={`/admin/dashboard/submissions`}
              aria-current="page">
              SUBMISSION DASHBOARD
            </Link>
            <Typography variant="body2" component="span">
              {dataset?.data.name} | {submissionUUID}
            </Typography>
          </Breadcrumbs>
        }
        subTitle={
          <Stack flexDirection="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
            <Stack flexDirection="row" alignItems="center">
              {submission?.security_review_timestamp ? (
                <>
                  <Icon path={mdiLock} size={0.75} color="#4caf50" />
                  <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
                    SECURED: {submission?.security_review_timestamp}
                  </Typography>
                </>
              ) : (
                <>
                  <Icon path={mdiLockOpen} size={0.75} color="#f44336" />
                  <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
                    PENDING REVIEW | SUBMITTED: {submission?.create_date}
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

              <Button variant="contained" color="primary">
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
              <MenuItem onClick={() => history.push('edit')}>
                <ListItemIcon>
                  <Icon path={mdiPencil} size={1} />
                </ListItemIcon>
                <Typography variant="inherit">MANAGE SECURITY</Typography>
              </MenuItem>
            </Menu>
          </>
        }
      />
    </>
  );
};

export default SubmissionHeader;
