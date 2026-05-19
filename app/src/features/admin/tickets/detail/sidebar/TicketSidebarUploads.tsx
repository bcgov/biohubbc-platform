import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TicketSidebarSection } from './TicketSidebarSection';

/**
 * Uploads section placeholder for ticket sidebar.
 *
 * @return {*}
 */
export const TicketSidebarUploads = () => {
  return (
    <TicketSidebarSection label="Uploads">
      <LoadingGuard
        hasNoData={true}
        hasNoDataFallback={
          <Typography variant="body2" color="textSecondary">
            No uploads
          </Typography>
        }>
        <></>
      </LoadingGuard>
    </TicketSidebarSection>
  );
};
