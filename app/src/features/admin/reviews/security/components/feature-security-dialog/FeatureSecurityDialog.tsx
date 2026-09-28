import { OkDialog } from 'components/dialog/OkDialog';
import { ISubmissionUploadReviewSecurityFeature } from 'interfaces/useAdminApi.interface';
import { FeatureSecurityRulesList } from './rules/FeatureSecurityRulesList';

interface FeatureSecurityDialogProps {
  submissionId: number;
  submissionUploadId: string;
  submissionUploadReviewId: string;
  feature: ISubmissionUploadReviewSecurityFeature | null;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Displays every direct or inherited security rule affecting one feature.
 *
 * @param {FeatureSecurityDialogProps} props - Feature context, review identifiers, and dialog close handler.
 * @returns {React.JSX.Element} Dialog containing the feature's paginated security-rule cards.
 */
export const FeatureSecurityDialog = (props: FeatureSecurityDialogProps) => {
  return (
    <OkDialog
      open={props.feature !== null}
      onClose={props.onClose}
      dialogTitle="Applied Security"
      dialogText=""
      dialogProps={{ fullWidth: true, maxWidth: 'sm' }}
      dialogContent={
        props.feature ? (
          <FeatureSecurityRulesList
            key={props.feature.submission_feature_id}
            onChanged={props.onChanged}
            submissionId={props.submissionId}
            submissionUploadId={props.submissionUploadId}
            submissionUploadReviewId={props.submissionUploadReviewId}
            submissionFeatureId={props.feature.submission_feature_id}
          />
        ) : null
      }
    />
  );
};
