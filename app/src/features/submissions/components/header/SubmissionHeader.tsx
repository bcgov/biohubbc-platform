import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useArtifactApi.interface';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { Link as RouterLink } from 'react-router-dom';

export type SubmissionDetailTab = 'details';

interface SubmissionHeaderProps {
  /** Submission represented by the header. */
  submission: SubmissionRecordWithSecurity;
  /** Query string preserved by the Search breadcrumb. */
  queryString: string;
  /** Currently selected submission detail tab. */
  activeTab: SubmissionDetailTab;
  /** Handles submission detail tab changes. */
  onTabChange: (tab: SubmissionDetailTab) => void;
}

/**
 * Renders the public submission detail header.
 *
 * Displays search breadcrumbs, submission metadata, secured status, and the available detail tabs.
 *
 * @param {SubmissionHeaderProps} props - Submission metadata, navigation state, and tab change handler.
 * @returns {JSX.Element} The public submission page header.
 */
export const SubmissionHeader = ({ submission, queryString, activeTab, onTabChange }: SubmissionHeaderProps) => {
  const hasSecuredFeatures =
    submission.security !== SECURITY_APPLIED_STATUS.UNSECURED &&
    submission.security !== SECURITY_APPLIED_STATUS.PENDING;

  return (
    <PageHeader
      breadcrumbs={
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to={`/search/${queryString}`} underline="hover" color="inherit">
            Search
          </Link>
          <Typography color="text.primary">{submission.name}</Typography>
        </Breadcrumbs>
      }
      label={submission.name}
      subheader={
        <Box display="flex" flexDirection="column" gap={1}>
          {submission.description && <Typography color="text.secondary">{submission.description}</Typography>}
          {hasSecuredFeatures && (
            <Box display="flex" gap={1}>
              <Chip icon={<Icon path={mdiLock} size={0.625} />} label="Contains secured features" size="small" />
            </Box>
          )}
        </Box>
      }
      tabs={
        <TabGroup<SubmissionDetailTab>
          value={activeTab}
          onChange={onTabChange}
          ariaLabel="Submission sections"
          tabs={[{ value: 'details', label: 'Details' }]}
        />
      }
    />
  );
};
