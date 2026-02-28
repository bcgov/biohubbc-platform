import EditDialog from 'components/dialog/EditDialog';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeam } from 'interfaces/useTeamsApi.interface';
import {
  ITeamPolicyFormValues,
  TeamPolicyForm,
  TeamPolicyFormYupSchema
} from './TeamPolicyForm';

export interface ICreateTeamPolicyDialogProps {
  open: boolean;
  isLoading: boolean;
  teams: ITeam[];
  policies: IPolicy[];
  initialValues: ITeamPolicyFormValues;
  onCancel: () => void;
  onSave: (values: ITeamPolicyFormValues) => void;
}

export const CreateTeamPolicyDialog: React.FC<ICreateTeamPolicyDialogProps> = ({
  open,
  isLoading,
  teams,
  policies,
  initialValues,
  onCancel,
  onSave
}) => {
  return (
    <EditDialog<ITeamPolicyFormValues>
      open={open}
      isLoading={isLoading}
      dialogTitle="Add Assignment"
      dialogSaveButtonLabel="Add"
      component={{
        element: <TeamPolicyForm teams={teams} policies={policies} />,
        initialValues,
        validationSchema: TeamPolicyFormYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};

export default CreateTeamPolicyDialog;
