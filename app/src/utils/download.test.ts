import { isExportReady, triggerIframeDownload } from './download';

describe('isExportReady', () => {
  it.each([
    { status: 'pending', expected: false },
    { status: 'processing', expected: false },
    { status: 'ready', expected: true },
    { status: 'failed', expected: false }
  ] as const)('returns $expected for status "$status"', ({ status, expected }) => {
    expect(isExportReady(status)).toBe(expected);
  });
});

describe('triggerIframeDownload', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('iframe').forEach((iframe) => iframe.remove());
  });

  it('injects a hidden iframe and removes it after 30 seconds', () => {
    vi.useFakeTimers();

    triggerIframeDownload('https://object-store.example/export.zip');

    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute('src', 'https://object-store.example/export.zip');
    expect(iframe).not.toBeVisible();

    vi.advanceTimersByTime(30000);

    expect(document.querySelector('iframe')).toBeNull();
  });
});
