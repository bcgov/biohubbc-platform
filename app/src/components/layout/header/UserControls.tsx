import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { mdiAccountCircle, mdiLoginVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { AuthStateContext } from 'contexts/authStateContext';
import { SYSTEM_IDENTITY_SOURCE } from 'hooks/useKeycloakWrapper';
import React, { useContext } from 'react';
import Link from '@mui/material/Link';
import { Theme } from '@mui/material';
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles((theme: Theme) => ({
  userInfo: {
    borderRight: '1px solid #ffffff'
  }
}));

export const LoggedInUserControls = () => {
  const classes = useStyles();
  const { keycloakWrapper } = useContext(AuthStateContext);

  const identitySource = keycloakWrapper?.getIdentitySource() || '';

  const userIdentifier = keycloakWrapper?.getUserIdentifier() || '';

  const loggedInUserDisplayName =
    identitySource === SYSTEM_IDENTITY_SOURCE.BCEID ? `BCEID / ${userIdentifier}` : `IDIR / ${userIdentifier}`;

  return (
    <Box display="flex" alignItems="center" pl={2}>
      <Box className={classes.userInfo} display="flex" flexDirection="row" alignItems="center" mr={2} pr={2}>
        <Icon path={mdiAccountCircle} size={1} />
        <Box component="span" ml={1}>{loggedInUserDisplayName}</Box>
      </Box>
      <Link href="/logout" data-testid="menu_log_out"
        sx={{
          color: 'bcgovblue.contrastText'
        }}>
        Log out
      </Link>
    </Box>
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
      color="bcgovblue"
      disableElevation
      startIcon={<Icon path={mdiLoginVariant} size={1.12} />}
      data-testid="login">
      Log In
    </Button>
  );
};
