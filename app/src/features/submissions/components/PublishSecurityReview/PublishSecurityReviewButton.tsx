import Button from '@mui/material/Button';
import PublishSecurityReviewDialog from 'features/submissions/components/PublishSecurityReview/PublishSecurityReviewDialog';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useState } from 'react';

export interface IPublishSecurityReviewButtonProps {
  submission: SubmissionRecordWithSecurity;
  onComplete: () => Promise<void>;
}

const PublishSecurityReviewButton = (props: IPublishSecurityReviewButtonProps) => {
  const [isCompleteReviewDialogOpen, setIsCompleteReviewDialogOpen] = useState(false);

  const { submission, onComplete } = props;

  return (
    <>
      <PublishSecurityReviewDialog
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
        disabled={submission.security_review_timestamp === null}
        onClick={() => {
          setIsCompleteReviewDialogOpen(true);
        }}
        aria-label="Complete Review">
        Publish
      </Button>
    </>
  );
};

export default PublishSecurityReviewButton;
