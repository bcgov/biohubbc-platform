import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import { AlertTitle, Container, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import { AlertBanner } from 'components/notifications/AlertBanner';

interface SearchResultSecuredAlertProps {
  /** Opens the access-request workflow for secured result records. */
  onRequestAccess: () => void;
}

/**
 * Displays the secured-results notice shown above search results when one or more
 * returned rows are hidden by data security rules.
 *
 * Use this component from `SearchResultPage` only when the current rows include
 * secured records. The parent owns navigation so this component stays
 * presentational and receives the access-request action as a callback.
 *
 * @param {SearchResultSecuredAlertProps} props - Callback for the "Request Access" action.
 * @returns {JSX.Element} Standard alert banner explaining secured results.
 */
export const SearchResultSecuredAlert = ({ onRequestAccess }: SearchResultSecuredAlertProps) => {
  return (
    <Container maxWidth="md" sx={{ pt: 2 }}>
      <AlertBanner
        variant="standard"
        icon={<Icon path={mdiLock} size={0.75} style={{ marginTop: '1px' }} />}
        action={
          <Button color="inherit" size="small" onClick={onRequestAccess}>
            Request Access
          </Button>
        }>
        <AlertTitle sx={{ mb: 0 }}>Sensitive results are hidden</AlertTitle>
        <Typography fontSize="0.8rem">
          Some data are secured under the Species and Ecosystems Data & Information Security Policy.
        </Typography>
      </AlertBanner>
    </Container>
  );
};
