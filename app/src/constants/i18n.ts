import { pluralize as p } from 'utils/Utils';

export const SystemUserI18N = {
  removeSystemUserTitle: 'Remove System User ',
  removeUserErrorTitle: 'Error Removing User From Team',
  removeUserErrorText:
    'An error has occurred while attempting to remove the user from the team, please try again. If the error persists, please contact your system administrator.'
};

export const AddSystemUserI18N = {
  addUserErrorTitle: 'Error Adding System User',
  addUserErrorText:
    'An error has occurred while attempting to add the system user. This user has already been granted this role. If the error persists, please contact your system administrator.'
};

export const UpdateSystemUserI18N = {
  updateUserErrorTitle: 'Error Updating System User',
  updateUserErrorText:
    'An error has occurred while attempting to update the system user. If the error persists, please contact your system administrator.'
};

export const DeleteSystemUserI18N = {
  deleteUserErrorTitle: 'Error Deleting System User',
  deleteUserErrorText:
    'An error has occurred while attempting to delete the system user. If the error persists, please contact your system administrator.'
};

export const ApplySecurityRulesI18N = {
  // TODO
  applySecuritySuccess: (numApplied: number, numRemoved: number, featureCount: number) => {
    const appliedRemoved = [
      numApplied > 0 && `applied ${numApplied} ${p(numApplied, 'security rule')}`,
      numRemoved > 0 && `removed ${numRemoved} ${p(numRemoved, 'security rule')}`
    ]
      .filter(Boolean)
      .join(' and ');

    return `Successfully ${appliedRemoved} to ${featureCount} ${p(featureCount, 'feature')}.`;
  },

  applySecurityRulesErrorTitle: 'Error Applying Security',
  applySecurityRulesErrorText:
    'An error occurred while applying security to features, please try again. If the problem persists, please contact your system administrator',
  unApplySecurityRulesSuccess: (submissionCount: number) => `Successfully unsecured: ${submissionCount} features`,
  unapplySecurityRulesErrorTitle: 'Error Unsecuring Features',
  unapplySecurityRulesErrorText:
    'Failed to unsecure the selected features, please try again. If the problem persists, please contact your system administrator'
};
