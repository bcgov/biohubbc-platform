import { Typography } from '@mui/material';
import EditDialog from 'components/dialog/EditDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IPolicy } from 'interfaces/usePolicyApi.interface';
import { useState } from 'react';
import * as yup from 'yup';
import { PolicyForm } from '../../form/PolicyForm';

export interface IPolicyFormValues {
  name: string;
  description: string | null;
  json: string;
}

interface IPolicyCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

const initialValues: IPolicyFormValues = {
  name: '',
  description: null,
  json: JSON.stringify(
    {
      name: '',
      description: '',
      statements: [],
    },
    null,
    2
  ),
};

const validationSchema = yup.object({
  json: yup
    .string()
    .required('Policy JSON is required')
    .test('is-json', 'Invalid JSON', (value) => {
      try {
        JSON.parse(value || '');
        return true;
      } catch {
        return false;
      }
    }),
});

export const PolicyCreateDialog: React.FC<IPolicyCreateDialogProps> = ({ open, onClose }) => {
  const api = useApi();
  const dialog = useDialogContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async (values: IPolicyFormValues) => {
    try {
      setIsLoading(true);
      const policy: IPolicy = JSON.parse(values.json);
      await api.policy.createPolicy(policy);

      dialog.setSnackbar({
        open: true,
        snackbarMessage: (
          <Typography variant="body2">
            Policy <strong>{policy.name}</strong> created.
          </Typography>
        ),
      });

      onClose();
    } catch (error: any) {
      dialog.setErrorDialog({
        open: true,
        dialogTitle: 'Error creating policy',
        dialogText: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <EditDialog<IPolicyFormValues>
      isLoading={isLoading}
      dialogTitle="Create Policy"
      open={open}
      dialogSaveButtonLabel="CREATE"
      onCancel={onClose}
      onSave={handleSave}
      component={{
        element: <PolicyForm />,
        initialValues,
        validationSchema,
      }}
    />
  );
};
