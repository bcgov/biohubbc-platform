import { AdminTicketContextProvider, UserTicketContextProvider } from 'contexts/ticketContext';
import { MemoryRouter, Route, Routes } from 'react-router';
import { renderHook, waitFor } from 'test-helpers/test-utils';
import { useTicketTagsQuery } from './useTicketTagsQuery';

const mocks = vi.hoisted(() => ({ getTicketTags: vi.fn() }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({ tags: { getTicketTags: mocks.getTicketTags } })
}));

const TICKET_ID = '11111111-1111-1111-1111-111111111111';
const ticketTags = {
  tags: [{ tag_id: 'tag-1', name: 'Urgent', color: '#D8292F', tag_rule_id: null, tag_rule_name: null }],
  events: []
};

/**
 * Renders the ticket tags query inside a ticket route and the given context provider.
 *
 * @param {React.ComponentType<React.PropsWithChildren>} Provider The ticket context provider.
 * @returns The RTL renderHook result.
 */
const renderTicketTagsQuery = (Provider: React.ComponentType<React.PropsWithChildren>) =>
  renderHook(() => useTicketTagsQuery(), {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[`/tickets/${TICKET_ID}`]}>
        <Routes>
          <Route path="/tickets/:ticketId" element={<Provider>{children}</Provider>} />
        </Routes>
      </MemoryRouter>
    )
  });

describe('useTicketTagsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTicketTags.mockResolvedValue(ticketTags);
  });

  it("reads an admin route ticket's tags and history", async () => {
    const { result } = renderTicketTagsQuery(AdminTicketContextProvider);

    await waitFor(() => expect(result.current.data).toEqual(ticketTags));
    expect(mocks.getTicketTags).toHaveBeenCalledWith(TICKET_ID, { signal: expect.any(AbortSignal) });
  });

  it('never requests tags for a portal route ticket', async () => {
    const { result } = renderTicketTagsQuery(UserTicketContextProvider);

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(result.current.data).toBeUndefined();
    expect(mocks.getTicketTags).not.toHaveBeenCalled();
  });
});
