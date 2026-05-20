import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext } from 'hooks/useContext';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { ReactNode } from 'react';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketArtifacts } from './TicketArtifacts';

vi.mock('hooks/useApi', () => ({
  useApi: vi.fn()
}));

vi.mock('hooks/useContext', () => ({
  useConfigContext: vi.fn(),
  useDialogContext: vi.fn()
}));

vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: ({
    rows,
    columns,
    rowCount,
    paginationMode,
    sortingMode
  }: {
    rows: Record<string, string | null>[];
    rowCount?: number;
    paginationMode?: string;
    sortingMode?: string;
    columns: Array<{
      field: string;
      headerName?: string;
      renderCell?: (params: { row: Record<string, string | null> }) => ReactNode;
      valueGetter?: (value: unknown, row: Record<string, string | null>) => ReactNode;
    }>;
  }) => (
    <div
      data-testid="ticket-artifacts-grid"
      data-row-count={rowCount}
      data-pagination-mode={paginationMode}
      data-sorting-mode={sortingMode}>
      {columns.map((column) => (
        <span key={column.field} data-testid={`ticket-artifacts-column-${column.field}`}>
          {column.headerName}
        </span>
      ))}
      {rows.map((row) => (
        <div key={row.ticket_artifact_id ?? ''}>
          {columns.map((column) => (
            <span key={`${row.ticket_artifact_id}-${column.field}`}>
              {column.renderCell?.({ row }) ?? column.valueGetter?.(row[column.field], row) ?? row[column.field]}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}));

const ticketArtifact: ITicketArtifact = {
  ticket_artifact_id: '55555555-5555-4555-8555-555555555555',
  ticket_id: '11111111-1111-4111-8111-111111111111',
  artifact_id: '66666666-6666-4666-8666-666666666666',
  record_end_date: null,
  create_date: '2026-02-25T12:00:00.000Z',
  object_key: 'tickets/test/file.txt'
};

const ticketId = ticketArtifact.ticket_id;

describe('TicketArtifacts', () => {
  const createTicketUpload = vi.fn();
  const completeTicketUpload = vi.fn();
  const getTicketArtifacts = vi.fn();
  const getTicketArtifactDownloadUrl = vi.fn();
  const uploadFileToUrl = vi.fn();
  const setSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    uploadFileToUrl.mockResolvedValue(undefined);

    (useApi as Mock).mockReturnValue({
      tickets: {
        createTicketUpload,
        completeTicketUpload,
        getTicketArtifacts,
        getTicketArtifactDownloadUrl
      },
      objectStorage: {
        uploadFileToUrl
      }
    });
    (useConfigContext as Mock).mockReturnValue({
      MAX_UPLOAD_NUM_FILES: 10,
      MAX_TICKET_ATTACHMENT_FILE_SIZE: 15728640
    });
    (useDialogContext as Mock).mockReturnValue({
      setSnackbar
    });
    getTicketArtifacts.mockResolvedValue({
      artifacts: [ticketArtifact],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10, sort: 'create_date', order: 'desc' }
    });
  });

  it('renders paginated ticket artifact rows in the artifacts section grid', async () => {
    render(<TicketArtifacts ticketId={ticketId} />);

    expect(screen.getByRole('heading', { name: 'Files' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeVisible();
    expect(screen.getByText('Ticket Artifact ID')).toBeVisible();
    expect(screen.getByText('Artifact Key')).toBeVisible();
    expect(screen.getByText('Create Date')).toBeVisible();
    expect(screen.getByText('Actions')).toBeVisible();
    expect(await screen.findByText(ticketArtifact.ticket_artifact_id)).toBeVisible();
    expect(screen.getByRole('link', { name: 'file.txt' })).toBeVisible();
    expect(screen.getByTestId('ticket-artifacts-grid')).toHaveAttribute('data-row-count', '1');
    expect(screen.getByTestId('ticket-artifacts-grid')).toHaveAttribute('data-pagination-mode', 'server');
    expect(screen.getByTestId('ticket-artifacts-grid')).toHaveAttribute('data-sorting-mode', 'server');
    expect(screen.queryByText(ticketArtifact.object_key)).not.toBeInTheDocument();
    expect(screen.getByText('February 25, 2026')).toBeVisible();
    expect(screen.queryByText(ticketArtifact.artifact_id)).not.toBeInTheDocument();
    expect(getTicketArtifacts).toHaveBeenCalledWith(ticketId, {
      search: '',
      page: 1,
      limit: 10,
      sort: 'create_date',
      order: 'desc'
    });
  });

  it('searches ticket artifacts by text input', async () => {
    const user = userEvent.setup();

    render(<TicketArtifacts ticketId={ticketId} />);

    await user.type(screen.getByPlaceholderText('Search files'), 'field note');

    await waitFor(() => {
      expect(getTicketArtifacts).toHaveBeenCalledWith(ticketId, {
        search: 'field note',
        page: 1,
        limit: 10,
        sort: 'create_date',
        order: 'desc'
      });
    });
  });

  it('uploads a selected file and refreshes ticket artifact data', async () => {
    const user = userEvent.setup();
    const uploadedTicketArtifact: ITicketArtifact = {
      ...ticketArtifact,
      ticket_artifact_id: '77777777-7777-4777-8777-777777777777',
      artifact_id: '88888888-8888-4888-8888-888888888888',
      object_key: 'tickets/test/uploaded.txt'
    };

    createTicketUpload.mockResolvedValue({
      upload_id: '99999999-9999-4999-8999-999999999999',
      presigned_upload_url: 'https://object-store.example/upload'
    });
    completeTicketUpload.mockResolvedValue(uploadedTicketArtifact);

    render(<TicketArtifacts ticketId={ticketId} />);

    await user.click(screen.getByRole('button', { name: 'Upload' }));
    await user.upload(
      screen.getByLabelText('Upload file input'),
      new File(['uploaded'], 'uploaded.txt', { type: 'text/plain' })
    );

    await waitFor(() => {
      expect(createTicketUpload).toHaveBeenCalledWith(ticketId, {
        file_name: 'uploaded.txt',
        byte_size: 8,
        content_type: 'text/plain'
      });
    });
    expect(completeTicketUpload).toHaveBeenCalledWith(ticketId, '99999999-9999-4999-8999-999999999999', {
      status: 'uploaded'
    });
    expect(uploadFileToUrl).toHaveBeenCalledWith({
      url: 'https://object-store.example/upload',
      file: expect.any(File),
      contentType: 'text/plain'
    });
    expect(getTicketArtifacts).toHaveBeenCalledTimes(2);
  });

  it('downloads a ticket artifact from the artifact key link using the signed download URL', async () => {
    const user = userEvent.setup();
    const artifactWindow = {
      opener: {},
      location: {
        href: ''
      },
      close: vi.fn()
    };

    vi.spyOn(window, 'open').mockReturnValue(artifactWindow as unknown as Window);
    getTicketArtifactDownloadUrl.mockResolvedValue({
      signed_url: 'https://object-store.example/download'
    });

    render(<TicketArtifacts ticketId={ticketId} />);

    await user.click(await screen.findByRole('link', { name: 'file.txt' }));

    await waitFor(() => {
      expect(getTicketArtifactDownloadUrl).toHaveBeenCalledWith(ticketId, ticketArtifact.ticket_artifact_id);
    });
    expect(artifactWindow.location.href).toBe('https://object-store.example/download');
  });

  it('copies artifact markdown for pasting into a ticket comment', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText
      }
    });

    render(<TicketArtifacts ticketId={ticketId} />);

    await user.click(await screen.findByRole('button', { name: 'Copy markdown for file.txt' }));

    expect(writeText).toHaveBeenCalledWith(`[file.txt](/artifact/${ticketArtifact.ticket_artifact_id})`);
    expect(setSnackbar).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Copied artifact markdown'
    });
  });
});
