import { AdminTicketContextProvider, UserTicketContextProvider } from 'contexts/ticketContext';
import { MemoryRouter, Route, Routes } from 'react-router';
import { renderHook, waitFor } from 'test-helpers/test-utils';
import { useTicketQuery } from './useTicketQuery';

const mocks = vi.hoisted(() => ({ getTicketForAdmin: vi.fn(), getTicketForUser: vi.fn() }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({ tickets: { getTicketForAdmin: mocks.getTicketForAdmin, getTicketForUser: mocks.getTicketForUser } })
}));

const TICKET_ID = '11111111-1111-1111-1111-111111111111';
const ticket = { ticket_id: TICKET_ID, ticket_slug: '04900001' };

/**
 * Renders the ticket query inside a ticket route and the given context provider.
 *
 * @param {React.ComponentType<React.PropsWithChildren>} Provider The ticket context provider.
 * @returns The RTL renderHook result.
 */
const renderTicketQuery = (Provider: React.ComponentType<React.PropsWithChildren>) =>
  renderHook(() => useTicketQuery(), {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[`/tickets/${TICKET_ID}`]}>
        <Routes>
          <Route path="/tickets/:ticketId" element={<Provider>{children}</Provider>} />
        </Routes>
      </MemoryRouter>
    )
  });

describe('useTicketQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTicketForAdmin.mockResolvedValue(ticket);
    mocks.getTicketForUser.mockResolvedValue(ticket);
  });

  it('reads an admin route ticket through the administrative endpoint', async () => {
    const { result } = renderTicketQuery(AdminTicketContextProvider);

    await waitFor(() => expect(result.current.data).toEqual(ticket));
    expect(mocks.getTicketForAdmin).toHaveBeenCalledWith(TICKET_ID, { signal: expect.any(AbortSignal) });
    expect(mocks.getTicketForUser).not.toHaveBeenCalled();
  });

  it('reads a portal route ticket through the user endpoint', async () => {
    const { result } = renderTicketQuery(UserTicketContextProvider);

    await waitFor(() => expect(result.current.data).toEqual(ticket));
    expect(mocks.getTicketForUser).toHaveBeenCalledWith(TICKET_ID, { signal: expect.any(AbortSignal) });
    expect(mocks.getTicketForAdmin).not.toHaveBeenCalled();
  });

  it('surfaces a failed load as the query error', async () => {
    const fetchError = new Error('admin fetch failed');
    mocks.getTicketForAdmin.mockRejectedValue(fetchError);
    const { result } = renderTicketQuery(AdminTicketContextProvider);

    await waitFor(() => expect(result.current.error).toBe(fetchError));
  });
});
