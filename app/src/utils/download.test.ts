import { triggerIframeDownload } from './download';

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
