import { act, renderHook } from '@testing-library/react';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { ITicketWithHistory } from 'interfaces/useTicketsApi.interface';
import { useOptimisticTicketHandlers } from './useOptimisticTicketHandlers';

const mockUpdateTicketStatus = vi.fn();
const mockSetYesNoDialog = vi.fn();
const mockSetSnackbar = vi.fn();
const mockSetTicketData = vi.fn();

const baseDataRequest: DataRequestResponse = {
  data_request_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  reason: 'Need data access',
  team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  requested_by: 1,
  ticket_id: '11111111-1111-1111-1111-111111111111',
  policy_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  status: PolicyStatus.REQUESTED,
  create_date: '2026-03-01T00:00:00.000Z'
};

const baseTicket: ITicketWithHistory = {
  ticket_id: '11111111-1111-1111-1111-111111111111',
  ticket_slug: '04900001',
  subject: 'Ticket subject',
  description: 'Ticket description',
  team_id: '22222222-2222-2222-2222-222222222222',
  create_date: '2026-03-01T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [],
  comments: [],
  references: [],
  data_requests: []
};

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    tickets: {
      updateTicketStatus: mockUpdateTicketStatus
    }
  })
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({
    setYesNoDialog: mockSetYesNoDialog,
    setSnackbar: mockSetSnackbar
  }),
  useTicketContext: () => ({
    ticketId: baseTicket.ticket_id,
    ticketDataLoader: {
      data: null,
      setData: mockSetTicketData
    }
  })
}));

describe('useOptimisticTicketHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows snackbar and blocks close confirmation when ticket has requested data requests', () => {
    const ticketWithUnaddressedDataRequest: ITicketWithHistory = {
      ...baseTicket,
      data_requests: [baseDataRequest]
    };

    const { result } = renderHook(() =>
      useOptimisticTicketHandlers({
        ticket: ticketWithUnaddressedDataRequest,
        userIdentifier: 'test-user'
      })
    );

    act(() => {
      result.current.requestStatusChange('closed');
    });

    expect(mockSetSnackbar).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Cannot close tickets that have unaddressed data requests'
    });
    expect(mockSetYesNoDialog).not.toHaveBeenCalled();
  });

  it('opens close confirmation when all data requests are actioned', () => {
    const ticketWithActionedDataRequest: ITicketWithHistory = {
      ...baseTicket,
      data_requests: [
        {
          ...baseDataRequest,
          status: PolicyStatus.APPROVED
        }
      ]
    };

    const { result } = renderHook(() =>
      useOptimisticTicketHandlers({
        ticket: ticketWithActionedDataRequest,
        userIdentifier: 'test-user'
      })
    );

    act(() => {
      result.current.requestStatusChange('closed');
    });

    expect(mockSetSnackbar).not.toHaveBeenCalled();
    expect(mockSetYesNoDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        dialogTitle: 'Close Ticket'
      })
    );
  });
});
