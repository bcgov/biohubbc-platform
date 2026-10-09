import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, Stack } from '@mui/material';
import { LabelledCard } from 'components/card/LabelledCard';
import { useFormikContext } from 'formik';
import { IContributorSystemUserOption } from 'interfaces/useContributorsApi.interface';
import { SystemUserSelect } from './SystemUserSelect';

export interface IContributorUserForm {
  user: IContributorSystemUserOption | null;
}

/**
 * Select a user in Formik and display a removable card before saving the relationship.
 * @param props - Whether submission is in progress.
 * @returns User search and the selected user card.
 */
export const ContributorUserForm = ({ disabled }: { disabled: boolean }) => {
  const { values, errors, setFieldValue } = useFormikContext<IContributorUserForm>();
  const handleSelectUser = (user: IContributorSystemUserOption | null) => setFieldValue('user', user);
  const handleRemoveUser = () => setFieldValue('user', null);
  const userLabel = values.user?.display_name || values.user?.user_identifier;

  return (
    <Stack spacing={2} sx={{ mt: 1, width: { xs: '100%', sm: 480 }, maxWidth: '100%' }}>
      <SystemUserSelect
        value={values.user}
        onChange={handleSelectUser}
        disabled={disabled}
        error={typeof errors.user === 'string' ? errors.user : undefined}
      />
      {values.user && (
        <LabelledCard
          label={userLabel}
          action={
            <IconButton size="small" aria-label={`Remove ${userLabel}`} onClick={handleRemoveUser} disabled={disabled}>
              <Icon path={mdiClose} size={0.65} />
            </IconButton>
          }
        />
      )}
    </Stack>
  );
};
