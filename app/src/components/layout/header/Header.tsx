import { mdiMenu } from '@mdi/js';
import Icon from '@mdi/react';
import { Menu, MenuItem, /*Theme*/ } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
// import { makeStyles } from '@mui/styles';
import headerImageLarge from 'assets/images/gov-bc-logo-horiz.png';
import headerImageSmall from 'assets/images/gov-bc-logo-vert.png';
import { AuthGuard, SystemRoleGuard, UnAuthGuard } from 'components/security/Guards';
import { SYSTEM_ROLE } from 'constants/roles';
import { Link as RouterLink } from 'react-router-dom';
import { useState } from 'react';
import { LoggedInUser, PublicViewUser } from './UserControls';

/*
const useStyles = makeStyles((theme: Theme) => ({
  govHeader: {},
  govHeaderToolbar: {
    height: '80px',
    backgroundColor: theme.palette.bcgovblue.main
  },
  brand: {
    display: 'flex',
    flex: '0 0 auto',
    alignItems: 'center',
    overflow: 'hidden',
    color: 'inherit',
    textDecoration: 'none',
    fontSize: '1.75rem',
    '& img': {
      marginTop: '-2px',
      verticalAlign: 'middle'
    },
    '& picture': {
      marginRight: '1.25rem'
    },
    '&:hover': {
      textDecoration: 'none'
    },
    '&:focus': {
      outlineOffset: '6px'
    }
  },
  '@media (max-width: 1000px)': {
    brand: {
      fontSize: '1rem',
      '& picture': {
        marginRight: '1rem'
      }
    },
    wrapText: {
      display: 'block'
    }
  },
  mainNav: {
    backgroundColor: '#38598a'
  },
  mainNavToolbar: {
    '& a': {
      display: 'block',
      padding: theme.spacing(2),
      color: 'inherit',
      fontSize: '1rem',
      textDecoration: 'none'
    },
    '& a:hover': {
      textDecoration: 'underline'
    },
    '& a:first-child': {
      marginLeft: theme.spacing(-2)
    }
  },
  '.MuiDialogContent-root': {
    '& p + p': {
      marginTop: theme.spacing(2)
    }
  }
}));
*/

const Header: React.FC<React.PropsWithChildren> = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const [open, setOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);

  // Support Dialog
  const showSupportDialog = () => {
    setOpen(true);
    hideMobileMenu();
  };

  const hideSupportDialog = () => {
    setOpen(false);
  };

  // Responsive Menu
  const showMobileMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const hideMobileMenu = () => {
    setAnchorEl(null);
  };

  const BetaLabel = () => {
    return <span aria-label="This application is currently in beta phase of development">Beta</span>;
  };

  // Unauthenticated public view
  const AppBrand = () => {
    return (
      <Box
        sx={{
          '& a': {
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            color: '#fff',
            fontSize: { xs: '16px', lg: '18px' },
            fontWeight: '400',
            textDecoration: 'none'
          },
          '& img': {
            mr: 2
          }
        }}>
        <RouterLink to="/" aria-label="Go to SIMS Home">
          <picture>
            <source srcSet={headerImageLarge} media="(min-width: 1200px)"></source>
            <source srcSet={headerImageSmall} media="(min-width: 600px)"></source>
            <img src={headerImageSmall} alt={'Government of British Columbia'} />
          </picture>
          <span>
            BioHub
            <Box
              component="sup"
              sx={{
                marginLeft: '4px',
                color: '#fcba19',
                fontSize: '0.75rem',
                fontWeight: 400,
                textTransform: 'uppercase'
              }}>
              <BetaLabel />
            </Box>
          </span>
        </RouterLink>
      </Box>
    );
  };


  return (
    <>
      <AppBar
        position="relative"
        elevation={0}
        sx={{
          fontFamily: 'BCSans, Verdana, Arial, sans-serif',
          backgroundColor: '#003366',
          borderBottom: '3px solid #fcba19'
        }}>
        <Toolbar
          sx={{
            height: { xs: '60px', lg: '80px' }
          }}>
          {/* Responsive Menu */}
          <Box display={{ sm: 'flex', lg: 'none' }} justifyContent="space-between" alignItems="center" flex="1 1 auto">
            <Box
              sx={{
                '& a': {
                  display: 'flex',
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: '400'
                }
              }}>
              <AppBrand></AppBrand>
            </Box>

            <Box>
              <UnAuthGuard>
                <PublicViewUser />
              </UnAuthGuard>
              <Button
                color="inherit"
                startIcon={<Icon path={mdiMenu} size={1.25}></Icon>}
                sx={{
                  ml: 2,
                  fontSize: '16px',
                  fontWeight: 700,
                  textTransform: 'none'
                }}
                aria-controls={menuOpen ? 'mobileMenu' : undefined}
                aria-haspopup="true"
                aria-expanded={menuOpen ? 'true' : undefined}
                onClick={showMobileMenu}>
                Menu
              </Button>
              <Menu
                id="mobileMenu"
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={hideMobileMenu}
                MenuListProps={{
                  'aria-labelledby': 'basic-button'
                }}
                sx={{
                  '& a': {
                    color: '#1a5a96',
                    borderRadius: 0,
                    fontWeight: 700,
                    textDecoration: 'none',
                    outline: 'none'
                  },
                  '& button': {
                    color: '#1a5a96',
                    fontWeight: 700
                  }
                }}>
                <MenuItem tabIndex={1} component={RouterLink} to="/" id="menu_home_sm">
                  Home
                </MenuItem>
                <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                  <MenuItem
                    tabIndex={1}
                    component={RouterLink}
                    to="/admin/dashboard"
                    id="menu_dashboard_sm"
                    onClick={hideMobileMenu}>
                    Dashboard
                  </MenuItem>
                </SystemRoleGuard>
                <MenuItem component={RouterLink} to="/submissions" id="menu_submissions_sm">
                  Submissions
                </MenuItem>
                <MenuItem component={RouterLink} to="/map" id="menu_map_sm">
                  Map Search
                </MenuItem>
                <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                  <MenuItem id="menu_admin_users_sm" component={RouterLink} to="/admin/users" onClick={hideMobileMenu}>
                    Manage Users
                  </MenuItem>
                </SystemRoleGuard>
                <MenuItem component="button" onClick={showSupportDialog} sx={{ width: '100%' }}>
                  Support
                </MenuItem>
                <AuthGuard>
                  <LoggedInUser />
                </AuthGuard>
              </Menu>
            </Box>
          </Box>

          {/* Desktop Menu */}
          <Box
            display={{ xs: 'none', lg: 'flex' }}
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            width="100%">
            <Box display="flex" flexDirection="row" alignItems="center">
              <Box
                sx={{
                  '& a': {
                    display: 'flex',
                    alignItems: 'center',
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: '400',
                    textDecoration: 'none'
                  }
                }}>
                <AppBrand></AppBrand>
              </Box>
              <Box
                ml={8}
                display="flex"
                alignItems="center"
                sx={{
                  '& a': {
                    p: 1,
                    color: 'inherit',
                    fontWeight: 700,
                    lineHeight: 1.75,
                    textDecoration: 'none'
                  },
                  '& a + a': {
                    ml: 1
                  },
                  '& button': {
                    fontSize: '16px',
                    fontWeight: 700,
                    textTransform: 'none'
                  }
                }}>
                <UnAuthGuard>
                  <RouterLink to="/" id="menu_home">
                    Home
                  </RouterLink>
                </UnAuthGuard>
                <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                  <RouterLink to="/admin/dashboard" id="menu_dashboard">
                    Dashboard
                  </RouterLink>
                </SystemRoleGuard>
                <RouterLink to="/submissions" id="menu_submissions">
                  Submissions
                </RouterLink>
                <RouterLink to="/map" id="menu_map">
                  Map Search
                </RouterLink>
                <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                  <RouterLink to="/admin/users" id="menu_admin_users">
                    Manage Users
                  </RouterLink>
                </SystemRoleGuard>
                <Button
                  color="inherit"
                  variant="text"
                  disableElevation
                  onClick={showSupportDialog}
                  sx={{
                    m: '8px',
                    p: 1
                  }}>
                  Support
                </Button>
              </Box>
            </Box>
            <Box flex="0 0 auto">
              <UnAuthGuard>
                <PublicViewUser />
              </UnAuthGuard>
              <AuthGuard>
                <LoggedInUser />
              </AuthGuard>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Dialog open={open}>
        <DialogTitle>Contact Support</DialogTitle>
        <DialogContent>
          <Typography variant="body1" component="div" color="textSecondary">
            For technical support or questions about this application, please email &zwnj;
            <a href="mailto:biohub@gov.bc.ca?subject=Support Request - Species Inventory Management System">
              biohub@gov.bc.ca
            </a>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="primary" onClick={hideSupportDialog}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  /*
  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Box className={classes.govHeader}>
          <Toolbar className={classes.govHeaderToolbar}>
            <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
              <Box display="flex" alignItems="center">
                <RouterLink to="/" className={classes.brand} aria-label="Go to Home Page">
                  <picture>
                    <source srcSet={headerImageLarge} media="(min-width: 1200px)"></source>
                    <source srcSet={headerImageSmall} media="(min-width: 600px)"></source>
                    <img src={headerImageSmall} alt={'Government of British Columbia'} />
                  </picture>
                  <span>
                    <strong>BioHub</strong>
                    <BetaLabel />
                  </span>
                </Link>
                <Box
                  ml={4}
                  sx={{
                    '& a': {
                      p: 2,
                      color: 'bcgovblue.contrastText',
                      fontWeight: 700,
                      textDecoration: 'none'
                    },
                    '& a:hover': {
                      textDecoration: 'underline'
                    }
                  }}>
                  <Link to="/" id="menu_home">
                    Home
                  </Link>
                  <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                    <Link to="/admin/dashboard" id="menu_admin_dashboard">
                      Dashboard
                    </Link>
                  </SystemRoleGuard>
                  <Link to="/submissions" id="submissions">
                    Submissions
                  </Link>
                  <Link to="/map" id="menu_map">
                    Map Search
                  </Link>
                  <SystemRoleGuard validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}>
                    <Link to="/admin/users" id="menu_admin_users">
                      Manage Users
                    </Link>
                  </SystemRoleGuard>
                </Box>
              </Box>
              <Box display="flex" alignItems="center">
                <IconButton
                  aria-label="Need help?"
                  onClick={showSupportDialog}
                  sx={{
                    color: 'bcgovblue.contrastText'
                  }}>
                  <Icon path={mdiHelpCircle} size={1} />
                </IconButton>
                <Box>
                  <UnAuthGuard>
                    <NotLoggedInUserControls />
                  </UnAuthGuard>
                  <AuthGuard>
                    <LoggedInUserControls />
                  </AuthGuard>
                </Box>
              </Box>
            </Box>
          </Toolbar>
        </Box>
      </AppBar>

      <Dialog open={openSupportDialog}>
        <DialogTitle>Need Help?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            For technical support or questions about this application, please contact:&nbsp;
            <Link
              href="mailto:biohub@gov.bc.ca?subject=BioHub - Secure Document Access Request"
              underline="always">
              biohub@gov.bc.ca
            </Link>
            .
          </Typography>
          <Typography variant="body1">A support representative will respond to your request shortly.</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="primary" onClick={hideSupportDialog}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
  */
};

export default Header;
