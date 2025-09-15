import Paper from '@mui/material/Paper';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { PolicyPagePolicy } from './policy/PolicyPagePolicy';
import { PolicyPageUser } from './user/PolicyPageUser';

type PolicyView = 'users' | 'policies';

/**
 * Policy page
 * @returns
 */
export const PolicyPageContainer = () => {
  const query = new URLSearchParams(useLocation().search);
  const activeView = (query.get('view') as PolicyView) ?? 'users';

  const api = useApi();
  const usersDataLoader = useDataLoader(() => api.user.getUsersList());

  useEffect(() => {
    usersDataLoader.load();
  }, [usersDataLoader]);

  const refreshUsers = () => {
    usersDataLoader.refresh();
  };

  const users = usersDataLoader.data ?? [];

  return (
    <Paper sx={{ p: 1 }}>
      <ComponentSwitch
        switch={activeView}
        components={{
          users: <PolicyPageUser activeUsers={users} refresh={refreshUsers} />,
          policies: <PolicyPagePolicy policies={[]} />,
        }}
      />
    </Paper>
  );
};
