import { fireEvent, render, screen } from 'test-helpers/test-utils';
import { TileSessionFrame } from './TileSessionFrame';

const session = { token: 'token-1', token_expires_in: 900 };

const renderFrame = (props: Partial<React.ComponentProps<typeof TileSessionFrame<typeof session>>> = {}) =>
  render(
    <TileSessionFrame testId="the-map" status="ready" session={session} onRetry={vi.fn()} height={240} {...props}>
      {(current) => <div data-testid="map-content">{current.token}</div>}
    </TileSessionFrame>
  );

describe('TileSessionFrame', () => {
  it('renders the map for a session in hand, inside a frame of the given size', () => {
    renderFrame();

    expect(screen.getByTestId('the-map')).toHaveStyle({ height: '240px' });
    expect(screen.getByTestId('map-content')).toHaveTextContent('token-1');
  });

  it('shows the skeleton only while there is no session at all', () => {
    renderFrame({ status: 'loading', session: null });

    expect(screen.getByTestId('the-map-loading')).toHaveStyle({ height: '240px' });
    expect(screen.queryByTestId('map-content')).not.toBeInTheDocument();
  });

  it('keeps the map on screen while a session in hand is being re-minted', () => {
    renderFrame({ status: 'loading' });

    expect(screen.getByTestId('the-map')).toBeInTheDocument();
    expect(screen.getByTestId('map-content')).toBeInTheDocument();
  });

  it('shows the empty message for a subject with nothing to map', () => {
    renderFrame({ status: 'empty', session: null, emptyMessage: 'Nothing to map.' });

    expect(screen.getByTestId('the-map-empty')).toBeInTheDocument();
    expect(screen.getByText('Nothing to map.')).toBeInTheDocument();
  });

  it('treats an empty status as an error when the caller has no empty message', () => {
    renderFrame({ status: 'empty', session: null });

    expect(screen.getByTestId('the-map-error')).toBeInTheDocument();
  });

  it('reports a failure in place and retries on request', () => {
    const onRetry = vi.fn();

    renderFrame({ status: 'error', session: null, onRetry });

    expect(screen.getByTestId('the-map-error')).toBeInTheDocument();
    expect(screen.getByText('The map could not be loaded.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
