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

export const BlockSystemUserI18N = {
  blockUserErrorTitle: 'Error Blocking System User',
  blockUserErrorText:
    'An error has occurred while attempting to block the system user. If the error persists, please contact your system administrator.'
};

export const ApplySecurityRulesI18N = {
  applySecuritySuccess: (featureCount: number) => {
    return `Updated security for ${featureCount} ${p(featureCount, 'feature')}.`;
  },

  applySecurityRulesErrorTitle: 'Error applying security rules',
  applySecurityRulesErrorText:
    'An error occurred while applying security to features, please try again. If the problem persists, please contact your system administrator',
  unApplySecurityRulesSuccess: (submissionCount: number) => `Successfully unsecured: ${submissionCount} features`,
  unapplySecurityRulesErrorTitle: 'Error unsecuring features',
  unapplySecurityRulesErrorText:
    'Failed to unsecure the selected features, please try again. If the problem persists, please contact your system administrator'
};
