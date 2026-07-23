import { cleanup, fireEvent, render } from 'test-helpers/test-utils';
import { SlippyMapDrawToolbar } from './SlippyMapDrawToolbar';

describe('SlippyMapDrawToolbar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders only the configured controls', () => {
    const { getByTestId, queryByTestId } = render(
      <SlippyMapDrawToolbar
        drawControls={{ polygon: true, trash: true }}
        activeDrawMode={null}
        isTrashEnabled={false}
        onSelectMode={vi.fn()}
        onTrash={vi.fn()}
      />
    );

    expect(getByTestId('slippy-map-draw-mode-polygon')).toBeVisible();
    expect(getByTestId('slippy-map-draw-trash')).toBeInTheDocument();
    expect(queryByTestId('slippy-map-draw-mode-point')).not.toBeInTheDocument();
    expect(queryByTestId('slippy-map-draw-mode-linestring')).not.toBeInTheDocument();
  });

  it('renders nothing when no controls are enabled', () => {
    const { queryByTestId } = render(
      <SlippyMapDrawToolbar
        drawControls={{}}
        activeDrawMode={null}
        isTrashEnabled={false}
        onSelectMode={vi.fn()}
        onTrash={vi.fn()}
      />
    );

    expect(queryByTestId('slippy-map-draw-toolbar')).not.toBeInTheDocument();
  });

  it('fires onSelectMode with the mode when a draw mode button is clicked', () => {
    const onSelectMode = vi.fn();

    const { getByTestId } = render(
      <SlippyMapDrawToolbar
        drawControls={{ point: true, lineString: true, polygon: true }}
        activeDrawMode={null}
        isTrashEnabled={false}
        onSelectMode={onSelectMode}
        onTrash={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('slippy-map-draw-mode-polygon'));

    expect(onSelectMode).toHaveBeenCalledWith('polygon');
  });

  it('fires onSelectMode with null when the active draw mode button is clicked again', () => {
    const onSelectMode = vi.fn();

    const { getByTestId } = render(
      <SlippyMapDrawToolbar
        drawControls={{ polygon: true }}
        activeDrawMode="polygon"
        isTrashEnabled={false}
        onSelectMode={onSelectMode}
        onTrash={vi.fn()}
      />
    );

    expect(getByTestId('slippy-map-draw-mode-polygon')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(getByTestId('slippy-map-draw-mode-polygon'));

    expect(onSelectMode).toHaveBeenCalledWith(null);
  });

  it('disables the trash button until a feature is selected', () => {
    const onTrash = vi.fn();

    const { getByTestId, rerender } = render(
      <SlippyMapDrawToolbar
        drawControls={{ polygon: true, trash: true }}
        activeDrawMode={null}
        isTrashEnabled={false}
        onSelectMode={vi.fn()}
        onTrash={onTrash}
      />
    );

    expect(getByTestId('slippy-map-draw-trash')).toBeDisabled();

    rerender(
      <SlippyMapDrawToolbar
        drawControls={{ polygon: true, trash: true }}
        activeDrawMode={null}
        isTrashEnabled={true}
        onSelectMode={vi.fn()}
        onTrash={onTrash}
      />
    );

    expect(getByTestId('slippy-map-draw-trash')).toBeEnabled();

    fireEvent.click(getByTestId('slippy-map-draw-trash'));

    expect(onTrash).toHaveBeenCalledTimes(1);
  });
});
