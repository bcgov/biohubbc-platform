import {
  mdiAccountOutline,
  mdiCogOutline,
  mdiCubeOutline,
  mdiHandBackRightOutline,
  mdiLockOutline,
  mdiTagMultipleOutline,
  mdiTicketOutline,
  mdiViewColumnOutline
} from '@mdi/js';
import Icon from '@mdi/react';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { SYSTEM_ROLE } from 'constants/roles';
import { SystemRoleGuard } from 'guards/Guards';
import { Link as RouterLink } from 'react-router-dom';

const ADMIN_SECTIONS = [
  { label: 'Tickets', icon: mdiTicketOutline, to: '/admin/tickets', validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN] },
  { label: 'Boards', icon: mdiViewColumnOutline, to: '/admin/boards', validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN] },
  { label: 'Tags', icon: mdiTagMultipleOutline, to: '/admin/tags', validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN] },
  { label: 'Users', icon: mdiAccountOutline, to: '/admin/users', validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN] },
  {
    label: 'Security',
    icon: mdiLockOutline,
    to: '/admin/security',
    validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]
  },
  {
    label: 'Submissions',
    icon: mdiCubeOutline,
    to: '/admin/submissions',
    validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]
  },
  {
    label: 'Data Requests',
    icon: mdiHandBackRightOutline,
    to: '/admin/data-requests',
    validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]
  },
  {
    label: 'Configuration',
    icon: mdiCogOutline,
    to: '/admin/configuration',
    validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN]
  }
];

/**
 * Administration landing page: a grid of cards, each navigating to one administrative section. A card is shown only
 * to the system roles its section's route admits.
 *
 * @returns {JSX.Element} Administrative section cards.
 */
export const AdminPage = () => {
  return (
    <>
      <PageHeader label="Administration" />
      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        <Grid container spacing={3}>
          {ADMIN_SECTIONS.map((section) => (
            <SystemRoleGuard key={section.to} validSystemRoles={section.validSystemRoles}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card elevation={0}>
                  <ButtonBase
                    component={RouterLink}
                    to={section.to}
                    sx={{
                      width: 1,
                      height: 200,
                      p: 3,
                      flexDirection: 'column',
                      gap: 1.5,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}>
                    <Icon path={section.icon} size={1.5} />
                    <Typography variant="h3" component="span" textAlign="center">
                      {section.label}
                    </Typography>
                  </ButtonBase>
                </Card>
              </Grid>
            </SystemRoleGuard>
          ))}
        </Grid>
      </Container>
    </>
  );
};
