import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { FEATURE_TYPE, FEATURE_TYPE_DISPLAY_LABEL } from 'constants/feature-type';
import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { buildSearchFeatureTypePath } from 'utils/routes';

export type SubmissionFeatureTab = 'details';

interface SubmissionFeatureHeaderProps {
  /** Submission feature represented by the header. */
  feature: ISubmissionFeature;
  /** Label for the first breadcrumb. */
  rootBreadcrumbLabel: string;
  /** Route for the first breadcrumb. */
  rootBreadcrumbTo: string;
  /** Base route used to link to the feature's submission. */
  submissionDetailBasePath: string;
  /** Query string preserved when navigating back to the submission. */
  queryString?: string;
  /** Optional page-level actions displayed in the header. */
  buttons?: ReactNode;
  /** Currently selected feature detail tab. */
  activeTab: SubmissionFeatureTab;
  /** Handles feature detail tab changes. */
  onTabChange: (tab: SubmissionFeatureTab) => void;
}

/**
 * Header for the submission feature detail page.
 *
 * Displays navigation breadcrumbs, the feature type title, an optional secured
 * status chip, a feature type chip linked to the corresponding search page, and
 * the available feature detail tabs.
 *
 * @param {SubmissionFeatureHeaderProps} props - Feature metadata, navigation routes, and optional actions.
 * @returns {JSX.Element} The submission feature page header.
 */
export const SubmissionFeatureHeader = ({
  feature,
  rootBreadcrumbLabel,
  rootBreadcrumbTo,
  submissionDetailBasePath,
  queryString = '',
  buttons,
  activeTab,
  onTabChange
}: SubmissionFeatureHeaderProps) => (
  <PageHeader
    buttons={buttons}
    breadcrumbs={
      <Breadcrumbs aria-label="breadcrumb">
        <Link component={RouterLink} to={rootBreadcrumbTo} underline="hover" color="inherit">
          {rootBreadcrumbLabel}
        </Link>
        <Link
          component={RouterLink}
          to={`${submissionDetailBasePath}/${feature.submission_id}${queryString}`}
          underline="hover"
          color="inherit">
          {feature.submission_name}
        </Link>
        <Typography color="text.primary">{feature.feature_type_display_name}</Typography>
      </Breadcrumbs>
    }
    label={
      <Box display="flex" alignItems="center" gap={1.5}>
        <Typography variant="h1" sx={{ ml: '-2px' }}>
          {feature.feature_type_display_name}
        </Typography>
      </Box>
    }
    subheader={
      <Box display="flex" gap={1}>
        {feature.secured && <Chip color="error" icon={<Icon path={mdiLock} size={0.625} />} label="Secured" />}
        <Chip
          component={RouterLink}
          to={buildSearchFeatureTypePath(feature.feature_type_name)}
          clickable
          label={
            FEATURE_TYPE_DISPLAY_LABEL[feature.feature_type_name as FEATURE_TYPE] ?? feature.feature_type_display_name
          }
        />
      </Box>
    }
    tabs={
      <TabGroup<SubmissionFeatureTab>
        value={activeTab}
        onChange={onTabChange}
        ariaLabel="Submission feature sections"
        tabs={[{ value: 'details', label: 'Details' }]}
      />
    }
  />
);
