import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import IconButton from '@mui/material/IconButton';
import { PageSection } from 'components/section/PageSection';
import { ISubmissionUploadReviewSecurityFeature } from 'interfaces/useAdminApi.interface';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { SecurityFeaturePropertiesTable } from './SecurityFeaturePropertiesTable';
import { SubmissionUploadReviewMap } from './SubmissionUploadReviewMap';

interface SecurityFeaturePropertiesPanelProps {
  submissionId: number;
  submissionUploadId: string;
  feature: ISubmissionUploadReviewSecurityFeature | null;
  onClose: () => void;
}

/**
 * Renders properties and the persistent map for the last focused feature.
 *
 * @param {SecurityFeaturePropertiesPanelProps} props - Security feature properties panel properties.
 * @returns {JSX.Element} Rendered security feature properties panel.
 */
export const SecurityFeaturePropertiesPanel = (props: SecurityFeaturePropertiesPanelProps) => {
  return (
    <PageSection
      id="security-feature-properties"
      label={props.feature ? getFeatureTypeDisplayLabel(props.feature.feature_type_name) : 'Properties'}
      headerContent={
        <IconButton aria-label="Close properties" onClick={props.onClose}>
          <Icon path={mdiClose} size={0.8} />
        </IconButton>
      }>
      <SubmissionUploadReviewMap
        submissionUploadId={props.submissionUploadId}
        submissionId={props.submissionId}
        submissionFeatureId={props.feature?.submission_feature_id ?? null}
      />
      {props.feature && (
        <SecurityFeaturePropertiesTable
          key={props.feature.submission_feature_id}
          submissionId={props.submissionId}
          submissionUploadId={props.submissionUploadId}
          submissionFeatureId={props.feature.submission_feature_id}
        />
      )}
    </PageSection>
  );
};
