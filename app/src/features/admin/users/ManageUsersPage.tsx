import Box from '@mui/material/Box';
import { useApi } from 'hooks/useApi';
import { IGetUserResponse } from 'interfaces/useUserApi.interface';
import React, { useEffect, useState } from 'react';
import ActiveUsersList from './ActiveUsersList';

/**
 * Page to display user management data/functionality.
 *
 * @return {*}
 */
const ManageUsersPage: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();

  const [activeUsers, setActiveUsers] = useState<IGetUserResponse[]>([]);
  const [isLoadingActiveUsers, setIsLoadingActiveUsers] = useState(false);
  const [hasLoadedActiveUsers, setHasLoadedActiveUsers] = useState(false);

  const refreshActiveUsers = async () => {
    const activeUsersResponse = await biohubApi.user.getUsersList();

    setActiveUsers(activeUsersResponse);
  };

  useEffect(() => {
    const getActiveUsers = async () => {
      const activeUsersResponse = await biohubApi.user.getUsersList();

      setActiveUsers(() => {
        setHasLoadedActiveUsers(true);
        setIsLoadingActiveUsers(false);
        return activeUsersResponse;
      });
    };

    if (hasLoadedActiveUsers || isLoadingActiveUsers) {
      return;
    }

    setIsLoadingActiveUsers(true);

    getActiveUsers();
  }, [biohubApi, isLoadingActiveUsers, hasLoadedActiveUsers]);

  return (
    <Box py={7}>
      <ActiveUsersList activeUsers={activeUsers} refresh={refreshActiveUsers} />
    </Box>
  );
};

export default ManageUsersPage;
