import { act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadUrlDisplay } from './DownloadUrlDisplay';

const TEST_URL = 'http://localhost:7100/api/download/abc-123';

describe('DownloadUrlDisplay', () => {
  let originalClipboard: Clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true
    });
    cleanup();
  });

  it('renders the URL text', () => {
    const { getByTestId } = render(<DownloadUrlDisplay url={TEST_URL} />);

    expect(getByTestId('download-url-text')).toHaveTextContent(TEST_URL);
  });

  it('copies URL to clipboard when copy button is clicked', async () => {
    const { getByTestId } = render(<DownloadUrlDisplay url={TEST_URL} />);

    fireEvent.click(getByTestId('copy-url-button'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_URL);
    });
  });

  it('shows copied feedback after successful copy', async () => {
    const { getByTestId } = render(<DownloadUrlDisplay url={TEST_URL} />);

    fireEvent.click(getByTestId('copy-url-button'));

    await waitFor(() => {
      expect(getByTestId('copy-url-button')).toHaveAttribute('aria-label', 'Copied');
    });
  });

  it('resets copied state after 2 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { getByTestId } = render(<DownloadUrlDisplay url={TEST_URL} />);

    fireEvent.click(getByTestId('copy-url-button'));

    await waitFor(() => {
      expect(getByTestId('copy-url-button')).toHaveAttribute('aria-label', 'Copied');
    });

    act(() => {
      vi.advanceTimersByTime(2001);
    });

    await waitFor(() => {
      expect(getByTestId('copy-url-button')).toHaveAttribute('aria-label', 'Copy download URL');
    });

    vi.useRealTimers();
  });

  it('does not show copied feedback when clipboard write fails', async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NotAllowedError'));

    const { getByTestId } = render(<DownloadUrlDisplay url={TEST_URL} />);

    fireEvent.click(getByTestId('copy-url-button'));

    // Wait for the promise rejection to be handled, then verify label stayed unchanged
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_URL);
    });

    expect(getByTestId('copy-url-button')).toHaveAttribute('aria-label', 'Copy download URL');
  });

  it('hides copy button when clipboard API is unavailable', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true
    });

    const { getByTestId, queryByTestId } = render(<DownloadUrlDisplay url={TEST_URL} />);

    expect(queryByTestId('copy-url-button')).not.toBeInTheDocument();
    expect(getByTestId('download-url-text')).toHaveTextContent(TEST_URL);
  });
});
