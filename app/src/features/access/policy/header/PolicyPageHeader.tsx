import { Typography } from '@mui/material';
import CustomToggleButtonGroup from 'components/button/toggle/CustomToggleButtonGroup';
import { useHistory, useLocation } from 'react-router';

export type POLICY_PAGE_VIEW = 'users' | 'policies' | 'teams';

export const PolicyPageHeader = () => {
  const location = useLocation();
  const history = useHistory();
  const query = new URLSearchParams(useLocation().search);

  const activeView: POLICY_PAGE_VIEW = (query.get('view') as POLICY_PAGE_VIEW) ?? 'users';

  const handleViewChange = (newView: POLICY_PAGE_VIEW) => {
    const params = new URLSearchParams(location.search);
    params.set('view', newView);
    history.replace({ ...location, search: params.toString() });
  };

  return (
    <>
      <Typography variant="h2" mb={4}>
        Access
      </Typography>
      <CustomToggleButtonGroup
        orientation="horizontal"
        views={[
          { value: 'users', label: 'Users' },
          { value: 'policies', label: 'Policies' }
        ]}
        activeView={activeView}
        onViewChange={handleViewChange}
      />
    </>
  );
};
