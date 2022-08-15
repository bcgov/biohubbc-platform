import Box from '@mui/material/Box';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import React from 'react';
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
    <Box py={7}>
      <ActiveUsersList activeUsers={usersDataLoader.data || []} refresh={usersDataLoader.refresh} />
    </Box>
  );
};

export default ManageUsersPage;
