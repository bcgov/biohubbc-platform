import { mdiAlertCircleOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { AuthStateContext } from 'contexts/authStateContext';
import { useContext } from 'react';
import { Redirect, useHistory } from 'react-router';

const AccessDenied = () => {
  const history = useHistory();

  const { keycloakWrapper } = useContext(AuthStateContext);

  if (!keycloakWrapper?.keycloak.authenticated) {
    // User is not logged in
    return <Redirect to={{ pathname: '/' }} />;
  }

  if (!keycloakWrapper.hasLoadedAllUserInfo) {
    // User data has not been loaded, can not yet determine if they have a role
    return <CircularProgress className="pageProgress" />;
  }

  return (
    <Container>
      <Box pt={6} textAlign="center">
        <Icon path={mdiAlertCircleOutline} size={2} color="#ff5252" />
        <h1>Access Denied</h1>
        <Typography>{`You do not have permission to access this page.`}</Typography>
        <Box pt={4}>
          <Button
            onClick={() => history.push('/')}
            type="submit"
            size="large"
            variant="contained"
            color="primary"
            data-testid="access-denied-return-home-button">
            Return Home
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default AccessDenied;
