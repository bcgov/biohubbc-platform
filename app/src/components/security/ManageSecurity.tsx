import { mdiSecurity } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { useSubmissionContext } from 'hooks/useContext';
import { useState } from 'react';
import SecuritiesDialog from './SecuritiesDialog';
import { GridRowSelectionModel } from '@mui/x-data-grid';

interface IManageSecurityProps {
  submissionFeatureIds: GridRowSelectionModel
  onClose: () => void;
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
        onClose={() => {
          props.onClose();
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
