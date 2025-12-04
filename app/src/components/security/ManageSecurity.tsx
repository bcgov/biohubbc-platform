import { mdiSecurity } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import { useSubmissionContext } from 'hooks/useContext';
import { useState } from 'react';
import SecuritiesDialog from './SecuritiesDialog';

interface IManageSecurityProps {
  submissionFeatureIds: Pick<GridRowSelectionModel, 'ids'>;
  onSubmit: () => void;
  onClose?: () => void;
}

const ManageSecurity = (props: IManageSecurityProps) => {
  const { submissionFeaturesAppliedRulesDataLoader } = useSubmissionContext();

  const hasSecurity = Boolean(submissionFeaturesAppliedRulesDataLoader.data?.length);

  const [isSecuritiesDialogOpen, setIsSecuritiesDialogOpen] = useState(false);

  return (
    <>
      <SecuritiesDialog
        submissionFeatureIds={props.submissionFeatureIds}
        open={isSecuritiesDialogOpen}
        onSubmit={props.onSubmit}
        onClose={() => {
          if (props.onClose) {
            props.onClose();
          }
          setIsSecuritiesDialogOpen(false);
        }}
      />
      <Button
        color="primary"
        data-testid="manage-security"
        variant="outlined"
        onClick={() => setIsSecuritiesDialogOpen(true)}
        startIcon={<Icon path={mdiSecurity} size={0.75} />}>
        {hasSecurity ? 'Edit Security' : 'Add Security'}
      </Button>
    </>
  );
};

export default ManageSecurity;
