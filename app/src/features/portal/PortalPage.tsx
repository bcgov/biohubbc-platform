import { mdiCubeOutline, mdiDownloadOutline, mdiHandBackRightOutline, mdiKeyOutline, mdiTicketOutline } from '@mdi/js';
import Icon from '@mdi/react';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { Link as RouterLink } from 'react-router-dom';

const PORTAL_SECTIONS = [
  { label: 'Submissions', icon: mdiCubeOutline, to: '/portal/submission' },
  { label: 'Downloads', icon: mdiDownloadOutline, to: '/portal/download' },
  { label: 'Data Requests', icon: mdiHandBackRightOutline, to: '/portal/data-request' },
  { label: 'Tickets', icon: mdiTicketOutline, to: '/portal/ticket' },
  { label: 'API Keys', icon: mdiKeyOutline, to: '/portal/api-key' }
];

/**
 * Portal landing page: a grid of cards, each navigating to one of the current user's portal sections.
 *
 * @returns {JSX.Element} Portal section cards.
 */
export const PortalPage = () => {
  return (
    <>
      <PageHeader label="Portal" />
      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        <Grid container spacing={3}>
          {PORTAL_SECTIONS.map((section) => (
            <Grid key={section.to} size={{ xs: 12, sm: 6, md: 4 }}>
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
          ))}
        </Grid>
      </Container>
    </>
  );
};
