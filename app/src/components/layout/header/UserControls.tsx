import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import { mdiAccountCircle, mdiLoginVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { AuthStateContext } from 'contexts/authStateContext';
import { SYSTEM_IDENTITY_SOURCE } from 'hooks/useKeycloakWrapper';
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';

export const LoggedInUserControls = () => {
  const { keycloakWrapper } = useContext(AuthStateContext);

  const identitySource = keycloakWrapper?.getIdentitySource() || '';

  const userIdentifier = keycloakWrapper?.getUserIdentifier() || '';

  function getDisplayName(userName: string, identitySource: string) {
    return identitySource === SYSTEM_IDENTITY_SOURCE.BCEID ? `BCEID / ${userName}` : `IDIR / ${userName}`;
  }

  const loggedInUserDisplayName = getDisplayName(userIdentifier, identitySource);

  return (
    <>
      <Icon path={mdiAccountCircle} size={1.12} />
      <Box ml={1}>{loggedInUserDisplayName}</Box>
      <Box px={2}>
        <Divider orientation="vertical" />
      </Box>
      <Link to="/logout" data-testid="menu_log_out">
        Log Out
      </Link>
    </>
  );
};

export const NotLoggedInUserControls = () => {
  const { keycloakWrapper } = useContext(AuthStateContext);

  return (
    <Button
      onClick={() => keycloakWrapper?.keycloak?.login()}
      size="large"
      type="submit"
      variant="contained"
      color="primary"
      disableElevation
      startIcon={<Icon path={mdiLoginVariant} size={1.12} />}
      data-testid="login">
      Log In
    </Button>
  );
};
