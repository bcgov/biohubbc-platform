import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { AdminTicketsBoardsContent } from './content/AdminTicketsBoardsContent';
import { AdminTicketsTagsContent } from './content/AdminTicketsTagsContent';
import { AdminTicketsTicketsContent } from './content/AdminTicketsTicketsContent';

/**
 * Administrative tickets page: every ticket, every board that groups tickets by tag, and every tag, through
 * URL-addressable tabs. Only the selected tab's table is mounted, so only it loads.
 *
 * @returns {JSX.Element} Tickets tabs and the selected table.
 */
export const AdminTicketsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = requestedTab === 'boards' || requestedTab === 'tags' ? requestedTab : 'tickets';

  return (
    <AdminPageLayout
      title="Tickets"
      breadcrumbs={
        <Breadcrumbs aria-label="tickets breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            Tickets
          </Typography>
        </Breadcrumbs>
      }
      tabs={[
        { value: 'tickets', label: 'Tickets', id: 'tickets-tickets', ariaControls: 'tickets-panel' },
        { value: 'boards', label: 'Boards', id: 'tickets-boards', ariaControls: 'tickets-panel' },
        { value: 'tags', label: 'Tags', id: 'tickets-tags', ariaControls: 'tickets-panel' }
      ]}
      activeTab={activeTab}
      onTabChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', value);
        setSearchParams(next);
      }}>
      <Box id="tickets-panel" role="tabpanel" aria-labelledby={`tickets-${activeTab}`}>
        {activeTab === 'tickets' && <AdminTicketsTicketsContent />}
        {activeTab === 'boards' && <AdminTicketsBoardsContent />}
        {activeTab === 'tags' && <AdminTicketsTagsContent />}
      </Box>
    </AdminPageLayout>
  );
};
