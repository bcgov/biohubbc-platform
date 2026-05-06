import { fireEvent, screen } from '@testing-library/react';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { ITicketContext } from 'contexts/ticketContext';
import { useTicketContext } from 'hooks/useContext';
import { DataLoader } from 'hooks/useDataLoader';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketDetailPage } from './TicketDetailPage';
import { useTicketComment } from './hooks/useTicketComment';

vi.mock('hooks/useContext', () => ({
  useTicketContext: vi.fn()
}));

vi.mock('./hooks/useTicketComment', () => ({
  useTicketComment: vi.fn()
}));

vi.mock('./detail/header/TicketHeader', () => ({
  TicketHeader: ({
    ticket,
    activeTab,
    onTabChange
  }: {
    ticket: ITicketExtended;
    activeTab: 'timeline' | 'artifacts';
    onTabChange: (tab: 'timeline' | 'artifacts') => void;
  }) => (
    <div data-testid="ticket-header" data-active-tab={activeTab}>
      {ticket.ticket_slug}
      <button onClick={() => onTabChange('timeline')}>Timeline</button>
      <button onClick={() => onTabChange('artifacts')}>Files</button>
    </div>
  )
}));

vi.mock('./detail/artifacts/TicketArtifacts', () => ({
  TicketArtifacts: ({ ticket }: { ticket: ITicketExtended }) => (
    <div data-testid="ticket-artifacts" data-artifact-count={String(ticket.artifacts.length)} />
  )
}));

vi.mock('./detail/timeline/TicketTimeline', () => ({
  TicketTimeline: ({ ticket, isLoading }: { ticket: ITicketExtended; isLoading: boolean }) => (
    <div
      data-testid="ticket-timeline"
      data-loading={String(isLoading)}
      data-ticket-id={ticket.ticket_id}
      data-events={JSON.stringify(
        [...ticket.statuses, ...ticket.comments, ...ticket.data_requests].sort(
          (a, b) => new Date(a.create_date ?? '').getTime() - new Date(b.create_date ?? '').getTime()
        )
      )}
    />
  )
}));

vi.mock('./detail/comment/TicketComment', () => ({
  TicketComment: ({
    comment,
    isSaving,
    isUploadingAttachment
  }: {
    comment: string;
    isSaving: boolean;
    isUploadingAttachment: boolean;
  }) => (
    <div
      data-testid="ticket-comment"
      data-comment={comment}
      data-saving={String(isSaving)}
      data-uploading={String(isUploadingAttachment)}
    />
  )
}));

vi.mock('./detail/sidebar/TicketSidebar', () => ({
  TicketSidebar: ({
    teamId,
    ticketSystemUsers,
    references,
    dataRequests
  }: {
    teamId?: string;
    ticketSystemUsers?: unknown[];
    references?: unknown[];
    dataRequests?: unknown[];
  }) => (
    <div
      data-testid="ticket-sidebar"
      data-team-id={teamId ?? ''}
      data-ticket-system-user-count={String(ticketSystemUsers?.length ?? 0)}
      data-reference-count={String(references?.length ?? 0)}
      data-data-request-count={String(dataRequests?.length ?? 0)}
    />
  )
}));

vi.mock('./detail/skeleton/TicketSkeleton', () => ({
  TicketSkeleton: () => <div data-testid="ticket-skeleton" />
}));

beforeEach(() => {
  // Prevent delayed setTimeout callbacks from firing after Vitest tears down the test environment.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const mockUseTicketContext = useTicketContext as Mock;
const mockUseTicketComment = useTicketComment as Mock;

const baseTicket: ITicketExtended = {
  ticket_id: '11111111-1111-1111-1111-111111111111',
  ticket_slug: '04900042',
  subject: 'Test Ticket',
  description: 'Test description',
  team_id: '22222222-2222-2222-2222-222222222222',
  create_date: '2026-02-24T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [
    {
      ticket_status_id: 'status-2',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      user_identifier: 'Bob',
      create_date: '2026-02-25T00:00:00.000Z',
      status: 'closed'
    },
    {
      ticket_status_id: 'status-1',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      user_identifier: 'Sarah',
      create_date: '2026-02-24T00:00:00.000Z',
      status: 'open'
    }
  ],
  artifacts: [],
  comments: [
    {
      ticket_comment_id: 'comment-1',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      user_identifier: 'Sarah',
      create_date: '2026-02-24T12:00:00.000Z',
      comment: 'New comment'
    }
  ],
  references: [
    {
      ticket_reference_id: 'ref-1',
      source_ticket_id: '11111111-1111-1111-1111-111111111111',
      source_ticket_slug: '04900042',
      source_ticket_subject: 'Test Ticket',
      target_ticket_id: '77777777-7777-7777-7777-777777777777',
      target_ticket_slug: '04900050',
      target_ticket_subject: 'Related ticket',
      relationship: 'relates_to',
      user_identifier: 'Sarah',
      create_date: '2026-02-25T00:00:00.000Z'
    }
  ],
  ticket_system_users: [],
  data_requests: [
    {
      data_request_id: 'dr-1',
      reason: 'Request secured records',
      team_id: '33333333-3333-3333-3333-333333333333',
      requested_by: 1,
      ticket_id: '11111111-1111-1111-1111-111111111111',
      policy_id: '44444444-4444-4444-4444-444444444444',
      status: PolicyStatus.REQUESTED,
      create_date: '2026-02-24T10:00:00.000Z'
    }
  ]
};

const setComment = vi.fn();
const onAddComment = vi.fn().mockResolvedValue(undefined);
const onUploadAttachment = vi.fn().mockResolvedValue(undefined);

const makeTicketContext = (ticket: ITicketExtended | undefined, isLoading = false): ITicketContext => {
  const ticketDataLoader: DataLoader<[string], ITicketExtended, unknown> = {
    data: ticket,
    error: undefined,
    isLoading,
    isReady: true,
    load: vi.fn(),
    refresh: vi.fn(),
    clear: vi.fn(),
    setData: vi.fn()
  };

  return {
    ticketId: '11111111-1111-1111-1111-111111111111',
    ticketDataLoader
  };
};

describe('TicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTicketComment.mockReturnValue({
      comment: 'Draft comment',
      setComment,
      isSavingComment: false,
      isUploadingAttachment: false,
      handleAddComment: onAddComment,
      handleUploadAttachment: onUploadAttachment
    });
  });

  it('renders header, timeline, sidebar, and comment for open tickets', () => {
    mockUseTicketContext.mockReturnValue(makeTicketContext(baseTicket, false));
    render(<TicketDetailPage />);

    expect(screen.getByTestId('ticket-header')).toHaveTextContent('04900042');
    expect(screen.getByTestId('ticket-comment')).toHaveAttribute('data-comment', 'Draft comment');
    expect(screen.getByTestId('ticket-sidebar')).toHaveAttribute('data-team-id', baseTicket.team_id);
    expect(screen.getByTestId('ticket-sidebar')).toHaveAttribute('data-reference-count', '1');
    expect(screen.getByTestId('ticket-sidebar')).toHaveAttribute('data-data-request-count', '1');
  });

  it('passes ticket data to timeline', () => {
    mockUseTicketContext.mockReturnValue(makeTicketContext(baseTicket, false));
    render(<TicketDetailPage />);

    const timeline = screen.getByTestId('ticket-timeline');
    const events = JSON.parse(timeline.getAttribute('data-events') ?? '[]') as Array<{ create_date: string }>;

    expect(timeline).toHaveAttribute('data-ticket-id', baseTicket.ticket_id);
    expect(events).toHaveLength(
      baseTicket.statuses.length + baseTicket.comments.length + baseTicket.data_requests.length
    );
    expect(timeline).toHaveAttribute('data-loading', 'false');
  });

  it('hides comment input for closed tickets', () => {
    mockUseTicketContext.mockReturnValue(makeTicketContext({ ...baseTicket, status: 'closed' }, false));
    render(<TicketDetailPage />);

    expect(screen.queryByTestId('ticket-comment')).not.toBeInTheDocument();
  });

  it('shows the loading skeleton when loading and no ticket is available', () => {
    mockUseTicketContext.mockReturnValue(makeTicketContext(undefined, true));
    render(<TicketDetailPage />);

    expect(screen.getByTestId('ticket-skeleton')).toBeVisible();
  });

  it('wires context and comment hook state into content rendering', () => {
    mockUseTicketContext.mockReturnValue(makeTicketContext(baseTicket, false));
    mockUseTicketComment.mockReturnValue({
      comment: 'Hook comment',
      setComment,
      isSavingComment: true,
      isUploadingAttachment: false,
      handleAddComment: onAddComment,
      handleUploadAttachment: onUploadAttachment
    });
    render(<TicketDetailPage />);

    expect(screen.getByTestId('ticket-header')).toHaveTextContent('04900042');
    expect(screen.getByTestId('ticket-comment')).toHaveAttribute('data-comment', 'Hook comment');
    expect(screen.getByTestId('ticket-comment')).toHaveAttribute('data-saving', 'true');
    expect(screen.getByTestId('ticket-timeline')).toHaveAttribute('data-loading', 'false');
  });

  it('switches from timeline to artifacts tab content', async () => {
    mockUseTicketContext.mockReturnValue(
      makeTicketContext({
        ...baseTicket,
        artifacts: [
          {
            ticket_artifact_id: '55555555-5555-4555-8555-555555555555',
            ticket_id: baseTicket.ticket_id,
            artifact_id: '66666666-6666-4666-8666-666666666666',
            record_end_date: null,
            create_date: '2026-02-26T00:00:00.000Z',
            key: 'tickets/test/file.txt'
          }
        ]
      })
    );

    render(<TicketDetailPage />);

    expect(screen.getByTestId('ticket-timeline')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Files' }));

    expect(screen.getByTestId('ticket-header')).toHaveAttribute('data-active-tab', 'artifacts');
    expect(screen.getByTestId('ticket-artifacts')).toHaveAttribute('data-artifact-count', '1');
    expect(screen.queryByTestId('ticket-timeline')).not.toBeInTheDocument();
  });
});
