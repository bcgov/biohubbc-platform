import { act } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { LoadingGuard } from './LoadingGuard';

describe('LoadingGuard', () => {
  beforeEach(() => {
    // Fake only the timer APIs the component uses, so the pending-timer assertions below count the
    // component's own timers rather than anything the renderer schedules.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the loading fallback for the delay, then renders the children', () => {
    const props = {
      isLoadingFallback: <span>loading</span>,
      isLoadingFallbackDelay: 300
    };

    const { getByText, queryByText, rerender } = render(
      <LoadingGuard isLoading {...props}>
        <span>content</span>
      </LoadingGuard>
    );

    expect(getByText('loading')).toBeInTheDocument();

    rerender(
      <LoadingGuard isLoading={false} {...props}>
        <span>content</span>
      </LoadingGuard>
    );

    expect(queryByText('content')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(getByText('content')).toBeInTheDocument();
  });

  it('clears the pending loading fallback timer when unmounted inside the delay window', () => {
    const { unmount } = render(
      <LoadingGuard isLoading={false} isLoadingFallback={<span>loading</span>} isLoadingFallbackDelay={300}>
        <span>content</span>
      </LoadingGuard>
    );

    unmount();

    // A timer left pending here updates an unmounted tree, and in a test run it fires against a
    // torn-down environment (`window is not defined`).
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the pending no data fallback timer when unmounted inside the delay window', () => {
    const { unmount } = render(
      <LoadingGuard hasNoData={false} hasNoDataFallback={<span>no data</span>} hasNoDataFallbackDelay={300}>
        <span>content</span>
      </LoadingGuard>
    );

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
