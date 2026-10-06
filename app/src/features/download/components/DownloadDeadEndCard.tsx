import { mdiHelpCircleOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

/**
 * Renders the shared unavailable state for inaccessible or missing downloads and versions.
 *
 * @return {JSX.Element} The unavailable-download message.
 */
export const DownloadDeadEndCard = () => (
  <Container maxWidth="sm">
    <Box pt={6} textAlign="center">
      <Icon path={mdiHelpCircleOutline} size={2} color="#ff5252" />
      <h1>Download not available</h1>
      <Typography>This download link is invalid or no longer accessible.</Typography>
    </Box>
  </Container>
);
