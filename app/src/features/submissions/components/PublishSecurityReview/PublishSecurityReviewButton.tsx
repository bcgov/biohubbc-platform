import Button from '@mui/material/Button';
import CompleteSecurityReviewDialog from 'features/submissions/components/PublishSecurityReview/CompleteSecurityReviewDialog';
import RemoveSecurityReviewDialog from 'features/submissions/components/PublishSecurityReview/RemoveSecurityReviewDialog';
import { SubmissionRecordWithSecurity } from 'interfaces/useDatasetApi.interface';
import { useState } from 'react';

export interface IPublishSecurityReviewButtonProps {
  submission: SubmissionRecordWithSecurity;
  onComplete: () => Promise<void>;
  onRemove: () => Promise<void>;
}

const PublishSecurityReviewButton = (props: IPublishSecurityReviewButtonProps) => {
  const [isCompleteReviewDialogOpen, setIsCompleteReviewDialogOpen] = useState(false);
  const [isRemoveReviewDialogOpen, setIsRemoveReviewDialogOpen] = useState(false);

  const { submission, onComplete, onRemove } = props;

  return (
    <>
      {(submission.security_review_timestamp && (
        <>
          <RemoveSecurityReviewDialog
            open={isRemoveReviewDialogOpen}
            onRemove={() => {
              onRemove();
              setIsRemoveReviewDialogOpen(false);
            }}
            onCancel={() => setIsRemoveReviewDialogOpen(false)}
          />
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setIsRemoveReviewDialogOpen(true);
            }}>
            Remove Review
          </Button>
        </>
      )) || (
        <>
          <CompleteSecurityReviewDialog
            open={isCompleteReviewDialogOpen}
            submission={submission}
            onComplete={() => {
              onComplete();
              setIsCompleteReviewDialogOpen(false);
            }}
            onCancel={() => setIsCompleteReviewDialogOpen(false)}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setIsCompleteReviewDialogOpen(true);
            }}>
            Complete Review
          </Button>
        </>
      )}
    </>
  );
};

export default PublishSecurityReviewButton;
