import EditDialog from 'components/dialog/EditDialog';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeam } from 'interfaces/useTeamsApi.interface';
import { ITeamPolicyFormValues, TeamPolicyForm, TeamPolicyFormYupSchema } from './TeamPolicyForm';

export interface IEditTeamPolicyDialogProps {
  open: boolean;
  isLoading: boolean;
  teams: ITeam[];
  policies: IPolicy[];
  initialValues: ITeamPolicyFormValues;
  onCancel: () => void;
  onSave: (values: ITeamPolicyFormValues) => void;
}

/**
 * Dialog for editing an existing team-policy assignment.
 *
 * @param {IEditTeamPolicyDialogProps} props
 * @returns {JSX.Element}
 */
export const EditTeamPolicyDialog = (props: IEditTeamPolicyDialogProps) => {
  const { open, isLoading, teams, policies, initialValues, onCancel, onSave } = props;
  return (
    <EditDialog<ITeamPolicyFormValues>
      open={open}
      isLoading={isLoading}
      dialogTitle="Edit Assignment"
      dialogSaveButtonLabel="Save"
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

export default EditTeamPolicyDialog;
