import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfigContext, useDialogContext } from 'hooks/useContext';
import { ComponentProps } from 'react';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketComment } from './TicketComment';

vi.mock('hooks/useContext', () => ({
  useConfigContext: vi.fn(),
  useDialogContext: vi.fn()
}));

const baseProps: Omit<ComponentProps<typeof TicketComment>, 'comment'> = {
  setComment: vi.fn(),
  isSaving: false,
  isUploadingAttachment: false,
  onUploadAttachment: vi.fn().mockResolvedValue(undefined),
  onAddComment: vi.fn().mockResolvedValue(undefined)
};

describe('TicketComment', () => {
  const setSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useConfigContext as Mock).mockReturnValue({
      MAX_UPLOAD_NUM_FILES: 10
    });
    (useDialogContext as Mock).mockReturnValue({
      setSnackbar
    });
  });

  it('defaults to Write tab and shows multiline text field', () => {
    render(<TicketComment {...baseProps} comment="Draft comment" />);

    expect(screen.getByText('New Comment')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Write' })).toBeVisible();
    expect(screen.getByPlaceholderText('Type your comment...')).toBeVisible();
  });

  it('renders markdown preview of current draft comment', async () => {
    const user = userEvent.setup();

    render(<TicketComment {...baseProps} comment={'# Title\n\n**bold** text'} />);

    await user.click(screen.getByRole('button', { name: 'Preview' }));

    expect(screen.getByRole('heading', { name: 'Title' })).toBeVisible();
    expect(screen.getByText('bold', { selector: 'strong' })).toBeVisible();
    expect(screen.queryByText('Nothing to preview.')).not.toBeInTheDocument();
  });

  it('updates preview when draft value changes without saving', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TicketComment {...baseProps} comment="**first**" />);

    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText('first', { selector: 'strong' })).toBeVisible();

    rerender(<TicketComment {...baseProps} comment="**second**" />);
    expect(screen.getByText('second', { selector: 'strong' })).toBeVisible();
  });

  it('shows empty preview state when draft is blank', async () => {
    const user = userEvent.setup();

    render(<TicketComment {...baseProps} comment="   " />);

    await user.click(screen.getByRole('button', { name: 'Preview' }));

    expect(screen.getByText('Nothing to preview.')).toBeVisible();
  });

  it('renders attached image markdown in preview', async () => {
    const user = userEvent.setup();

    render(<TicketComment {...baseProps} comment="![diagram.png](/artifact/05c4063e-a344-42a6-89f8-b15161789cda)" />);

    await user.click(screen.getByRole('button', { name: 'Preview' }));

    expect(screen.getByText('diagram.png')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'diagram.png' })).not.toBeInTheDocument();
  });

  it('renders unresolved artifact markdown as a non-interactive file link in preview', async () => {
    const user = userEvent.setup();

    render(
      <TicketComment {...baseProps} comment="[copied artifact](/artifact/05c4063e-a344-42a6-89f8-b15161789cda)" />
    );

    await user.click(screen.getByRole('button', { name: 'Preview' }));

    expect(screen.getByText('copied artifact')).toBeVisible();
    expect(screen.queryByText('File not found')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'copied artifact' })).not.toBeInTheDocument();
  });

  it('submits comments and shows loading state while saving', async () => {
    const user = userEvent.setup();
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<TicketComment {...baseProps} onAddComment={onAddComment} comment="   " />);

    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();

    rerender(<TicketComment {...baseProps} onAddComment={onAddComment} comment="ready" />);
    expect(screen.getByRole('button', { name: 'Comment' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Comment' }));
    expect(onAddComment).toHaveBeenCalledTimes(1);

    rerender(<TicketComment {...baseProps} onAddComment={onAddComment} isSaving={true} comment="ready" />);
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeVisible();
  });

  it('disables attachment upload while the comment is saving', () => {
    const onUploadAttachment = vi.fn().mockResolvedValue(undefined);

    render(
      <TicketComment {...baseProps} comment="Draft comment" isSaving={true} onUploadAttachment={onUploadAttachment} />
    );

    expect(screen.getByRole('button', { name: 'Attach' })).toBeDisabled();
  });

  it('triggers attachment callback when a file is selected', async () => {
    const user = userEvent.setup();
    const onUploadAttachment = vi.fn().mockResolvedValue(undefined);

    render(<TicketComment {...baseProps} comment="Draft comment" onUploadAttachment={onUploadAttachment} />);

    const fileInput = screen.getByLabelText('Attach file input') as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    await user.upload(fileInput, file);

    expect(onUploadAttachment).toHaveBeenCalledTimes(1);
    expect(onUploadAttachment.mock.calls[0][0]).toEqual(expect.objectContaining({ name: 'hello.txt' }));
  });

  it('uploads each selected attachment up to the configured maximum', async () => {
    const user = userEvent.setup();
    const onUploadAttachment = vi.fn().mockResolvedValue(undefined);

    render(<TicketComment {...baseProps} comment="Draft comment" onUploadAttachment={onUploadAttachment} />);

    const fileInput = screen.getByLabelText('Attach file input') as HTMLInputElement;
    const files = [
      new File(['first'], 'first.txt', { type: 'text/plain' }),
      new File(['second'], 'second.txt', { type: 'text/plain' })
    ];

    await user.upload(fileInput, files);

    expect(onUploadAttachment).toHaveBeenCalledTimes(2);
    expect(onUploadAttachment.mock.calls[0][0]).toEqual(expect.objectContaining({ name: 'first.txt' }));
    expect(onUploadAttachment.mock.calls[1][0]).toEqual(expect.objectContaining({ name: 'second.txt' }));
  });

  it('rejects selected attachments above the configured maximum file count', async () => {
    const user = userEvent.setup();
    const onUploadAttachment = vi.fn().mockResolvedValue(undefined);
    (useConfigContext as Mock).mockReturnValue({
      MAX_UPLOAD_NUM_FILES: 1
    });

    render(<TicketComment {...baseProps} comment="Draft comment" onUploadAttachment={onUploadAttachment} />);

    const fileInput = screen.getByLabelText('Attach file input') as HTMLInputElement;
    const files = [
      new File(['first'], 'first.txt', { type: 'text/plain' }),
      new File(['second'], 'second.txt', { type: 'text/plain' })
    ];

    await user.upload(fileInput, files);

    expect(setSnackbar).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Number of artifacts selected at once exceeds maximum'
    });
    expect(onUploadAttachment).not.toHaveBeenCalled();
  });
});
