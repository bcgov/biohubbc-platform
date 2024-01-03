import Button from '@mui/material/Button';
import PublishSecurityReviewDialog from 'features/submissions/components/PublishSecurityReview/PublishSecurityReviewDialog';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useState } from 'react';
import UnPublishReviewDialog from './UnPublishReviewDialog';

export interface IPublishSecurityReviewButtonProps {
  submission: SubmissionRecordWithSecurity;
  onComplete: () => Promise<void>;
  onUnpublish: () => Promise<void>;
}

const PublishSecurityReviewButton = (props: IPublishSecurityReviewButtonProps) => {
  const [isCompletePublishDialogOpen, setIsCompletePublishDialogOpen] = useState(false);
  const [isUnPublishDialogOpen, setIsUnPublishDialogOpen] = useState(false);

  const { submission, onComplete, onUnpublish } = props;

  return (
    <>
      {(submission.publish_timestamp && (
        <>
          <UnPublishReviewDialog
            open={isUnPublishDialogOpen}
            onRemove={() => {
              onUnpublish();
              setIsUnPublishDialogOpen(false);
            }}
            onCancel={() => setIsUnPublishDialogOpen(false)}
          />
          <Button
            variant="outlined"
            color="primary"
            disabled={submission.security_review_timestamp === null}
            onClick={() => {
              setIsUnPublishDialogOpen(true);
            }}
            aria-label="Complete Review">
            UnPublish
          </Button>
        </>
      )) || (
        <>
          <PublishSecurityReviewDialog
            open={isCompletePublishDialogOpen}
            submission={submission}
            onComplete={() => {
              onComplete();
              setIsCompletePublishDialogOpen(false);
            }}
            onCancel={() => setIsCompletePublishDialogOpen(false)}
          />
          <Button
            variant="contained"
            color="primary"
            disabled={submission.security_review_timestamp === null}
            onClick={() => {
              setIsCompletePublishDialogOpen(true);
            }}
            aria-label="Complete Review">
            Publish
          </Button>
        </>
      )}
    </>
  );
};

export default PublishSecurityReviewButton;
