import { SYSTEM_ROLE } from 'constants/roles';
import { DialogContextProvider } from 'contexts/dialogContext';
import { TicketContext } from 'contexts/ticketContext';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from 'test-helpers/test-utils';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { Mock } from 'vitest';
import { PortalTicketDetailPage } from './PortalTicketDetailPage';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('hooks/useAuthStateContext', () => ({ useAuthStateContext: vi.fn() }));
vi.mock('hooks/useContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('hooks/useContext')>()),
  useConfigContext: () => ({ MAX_TICKET_ATTACHMENT_FILE_SIZE: 15728640 })
}));
vi.mock('@monaco-editor/react', () => ({
  default: () => <textarea data-testid="monaco-editor" />,
  loader: { init: vi.fn().mockResolvedValue({}) }
}));

const ticketId = '11111111-1111-4111-8111-111111111111';
const ticket: ITicketExtended = {
  ticket_id: ticketId,
  ticket_slug: '04900042',
  subject: 'Portal ticket',
  description: null,
  team_id: '22222222-2222-4222-8222-222222222222',
  create_date: '2026-02-24T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [
    {
      ticket_status_id: 'status-1',
      ticket_id: ticketId,
      user_identifier: 'sarah',
      create_date: '2026-02-24T00:00:00.000Z',
      status: 'open'
    }
  ],
  comments: [],
  references: [],
  data_requests: [],
  submission_uploads: [],
  ticket_system_users: []
};

describe('PortalTicketDetailPage', () => {
  const tagsApi = { getTags: vi.fn(), getTicketTags: vi.fn(), updateTicketTags: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStateContext as Mock).mockReturnValue({
      biohubUserWrapper: { roleNames: [SYSTEM_ROLE.SYSTEM_ADMIN] }
    });
    (useApi as Mock).mockReturnValue({
      tickets: { getTicketForUser: vi.fn().mockResolvedValue(ticket), getTicketForAdmin: vi.fn() },
      teams: { getTeamMembers: vi.fn().mockResolvedValue({ members: [] }) },
      tags: tagsApi
    });
  });

  it('shows the ticket timeline without requesting or showing tags, even for a system administrator', async () => {
    render(
      <DialogContextProvider>
        <MemoryRouter>
          {/* The portal's ticket context: the ticket is read through the user scope. */}
          <TicketContext.Provider
            value={{ ticketId, ticketScope: 'user', ticketQueryKey: ticketQueryKeys.detail('user', ticketId) }}>
            <PortalTicketDetailPage />
          </TicketContext.Provider>
        </MemoryRouter>
      </DialogContextProvider>
    );

    expect(await screen.findByText('sarah opened the ticket')).toBeVisible();
    await waitFor(() => expect(screen.queryByTestId('ticket-skeleton')).not.toBeInTheDocument());
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    expect(tagsApi.getTicketTags).not.toHaveBeenCalled();
    expect(tagsApi.getTags).not.toHaveBeenCalled();
  });
});
