import { mdiAccountCircle, mdiLoginVariant } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { SYSTEM_IDENTITY_SOURCE } from 'hooks/useKeycloakWrapper';
import { useMemo } from 'react';
import { getFormattedIdentitySource } from 'utils/Utils';

// Authenticated view
export const LoggedInUser = () => {
  const { keycloakWrapper } = useAuthStateContext();

  const identitySource = keycloakWrapper?.getIdentitySource() || '';
  const userIdentifier = keycloakWrapper?.getUserIdentifier() || '';
  const formattedUsername = [getFormattedIdentitySource(identitySource as SYSTEM_IDENTITY_SOURCE), userIdentifier]
    .filter(Boolean)
    .join('/');

  return (
    <>
      <Box
        display={{ xs: 'none', lg: 'flex' }}
        alignItems="center"
        sx={{
          fontSize: '16px',
          fontWeight: 700
        }}>
        <Box
          display="flex"
          alignItems="center"
          sx={{
            padding: '6px 14px',
            lineHeight: '1.75'
          }}>
          <Icon path={mdiAccountCircle} size={1} />
          <Box ml={1}>{formattedUsername}</Box>
        </Box>
        <Divider
          orientation="vertical"
          sx={{
            marginRight: '6px',
            height: '20px',
            borderColor: '#fff'
          }}
        />
        <Button
          component="a"
          variant="text"
          href="/logout"
          data-testid="menu_log_out"
          sx={{
            color: 'inherit',
            fontSize: '16px',
            fontWeight: 700,
            textTransform: 'none'
          }}>
          Log Out
        </Button>
      </Box>
      <MenuItem
        component="a"
        color="#1a5a96"
        href="/logout"
        data-testid="collapsed_menu_log_out"
        sx={{
          display: { xs: 'block', lg: 'none' }
        }}>
        Log out
      </MenuItem>
    </>
  );
};

// Unauthenticated public view
export const PublicViewUser = () => {
  const { keycloakWrapper } = useAuthStateContext();
  const loginUrl = useMemo(() => keycloakWrapper?.getLoginUrl(), [keycloakWrapper]);

  return (
    <>
      <Button
        component="a"
        color="inherit"
        variant="text"
        href={loginUrl}
        disableElevation
        startIcon={<Icon path={mdiLoginVariant} size={1} />}
        data-testid="menu_log_in"
        sx={{
          p: 1,
          fontSize: '16px',
          fontWeight: 700,
          textTransform: 'none'
        }}>
        Log In
      </Button>
    </>
  );
};
