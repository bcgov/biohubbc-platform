import Box from '@mui/material/Box';
import { PageHeader } from 'components/header/PageHeader';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import ActiveUsersList from './ActiveUsersList';

/**
 * Page to display user management data/functionality.
 *
 * @return {*}
 */
const ManageUsersPage: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();

  const usersDataLoader = useDataLoader(() => biohubApi.user.getUsersList());
  usersDataLoader.load();

  return (
    <>
      <PageHeader label="Manage Users" />
      <Box py={4}>
        <ActiveUsersList activeUsers={usersDataLoader.data || []} refresh={usersDataLoader.refresh} />
      </Box>
    </>
  );
};

export default ManageUsersPage;
