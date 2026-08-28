import { mdiMapMarker, mdiTrashCanOutline, mdiVectorLine, mdiVectorPolygon } from '@mdi/js';
import Icon from '@mdi/react';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { ISlippyMapDrawControls, SlippyMapDrawMode } from '../SlippyMap.interface';
import { DRAW_MODE_CONTROL_KEYS } from '../SlippyMap.utils';

export interface ISlippyMapDrawToolbarProps {
  /**
   * Which drawing controls to render.
   */
  drawControls: ISlippyMapDrawControls;
  /**
   * The currently active draw mode, or `null` when selecting/panning.
   */
  activeDrawMode: SlippyMapDrawMode | null;
  /**
   * Whether the trash control is actionable (a feature is selected).
   */
  isTrashEnabled: boolean;
  /**
   * Fired when the user activates a draw mode, or `null` when returning to selecting/panning.
   */
  onSelectMode: (mode: SlippyMapDrawMode | null) => void;
  /**
   * Fired when the user clicks the trash control.
   */
  onTrash: () => void;
}

/**
 * Buttons for the draw modes the toolbar can render, in display order.
 *
 * Which control gates each mode comes from `DRAW_MODE_CONTROL_KEYS`, the same mapping the map uses to decide whether
 * the active mode is still reachable, so a button and its mode are enabled by the one control.
 */
const DRAW_MODE_BUTTONS: {
  mode: SlippyMapDrawMode;
  controlKey: keyof ISlippyMapDrawControls;
  label: string;
  iconPath: string;
}[] = [
  { mode: 'point', controlKey: DRAW_MODE_CONTROL_KEYS.point, label: 'Draw a point', iconPath: mdiMapMarker },
  {
    mode: 'linestring',
    controlKey: DRAW_MODE_CONTROL_KEYS.linestring,
    label: 'Draw a line',
    iconPath: mdiVectorLine
  },
  { mode: 'polygon', controlKey: DRAW_MODE_CONTROL_KEYS.polygon, label: 'Draw a polygon', iconPath: mdiVectorPolygon }
];

/**
 * Presentational drawing toolbar overlaid on the `SlippyMap`.
 *
 * Renders a toggle button per enabled draw mode and an optional trash button. Has no knowledge of the underlying
 * map or drawing library.
 *
 * @param {ISlippyMapDrawToolbarProps} props
 * @return {JSX.Element | null}
 */
export const SlippyMapDrawToolbar = (props: ISlippyMapDrawToolbarProps) => {
  const { drawControls, activeDrawMode, isTrashEnabled, onSelectMode, onTrash } = props;

  const enabledModeButtons = DRAW_MODE_BUTTONS.filter((button) => drawControls[button.controlKey]);
  const isTrashVisible = Boolean(drawControls.trash);

  if (!enabledModeButtons.length && !isTrashVisible) {
    return null;
  }

  return (
    <Paper
      data-testid="slippy-map-draw-toolbar"
      elevation={2}
      sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, display: 'flex', flexDirection: 'column' }}>
      {enabledModeButtons.length > 0 && (
        <ToggleButtonGroup
          orientation="vertical"
          exclusive
          size="small"
          value={activeDrawMode}
          onChange={(_event, mode: SlippyMapDrawMode | null) => onSelectMode(mode)}>
          {enabledModeButtons.map((button) => (
            <ToggleButton
              key={button.mode}
              value={button.mode}
              aria-label={button.label}
              data-testid={`slippy-map-draw-mode-${button.mode}`}>
              <Icon path={button.iconPath} size={0.8} />
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
      {isTrashVisible && (
        <>
          {enabledModeButtons.length > 0 && <Divider flexItem />}
          <IconButton
            aria-label="Delete selected feature"
            data-testid="slippy-map-draw-trash"
            size="small"
            disabled={!isTrashEnabled}
            onClick={onTrash}
            sx={{ borderRadius: 0, p: '7px' }}>
            <Icon path={mdiTrashCanOutline} size={0.8} />
          </IconButton>
        </>
      )}
    </Paper>
  );
};
