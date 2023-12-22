import { mdiSecurity } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { useSubmissionContext } from 'hooks/useContext';
import { useState } from 'react';
import SecuritiesDialog from './SecuritiesDialog';
import UnsecureDialog from './UnsecureDialog';

interface IManageSecurityProps {
  features: number[];
  onClose: () => void;
}

const ManageSecurity = (props: IManageSecurityProps) => {
  const { submissionFeaturesAppliedRulesDataLoader } = useSubmissionContext();

  const hasSecurity = Boolean(submissionFeaturesAppliedRulesDataLoader.data?.length);

  const [isUnsecureDialogOpen, setIsUnsecuredDialogOpen] = useState(false);
  const [isSecuritiesDialogOpen, setIsSecuritiesDialogOpen] = useState(false);

  return (
    <>
      <SecuritiesDialog
        features={props.features}
        open={isSecuritiesDialogOpen}
        onClose={() => {
          props.onClose();
          setIsSecuritiesDialogOpen(false);
        }}
      />
      <UnsecureDialog
        features={props.features}
        open={isUnsecureDialogOpen}
        onClose={() => {
          props.onClose();
          setIsUnsecuredDialogOpen(false);
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
