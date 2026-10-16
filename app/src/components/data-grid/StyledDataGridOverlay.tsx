import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Height in pixels of the no-rows overlay. The data grid sizes its empty body to this value, so the overlay and the
 * table around it always line up.
 */
export const DATA_GRID_OVERLAY_HEIGHT = 160;

export interface IStyledDataGridOverlayProps {
  message?: string;
  /** Optional action shown under the message, such as a button that leads to where rows are added. */
  action?: React.ReactNode;
}

/**
 * Default no-rows overlay for data grids.
 *
 * @param {IStyledDataGridOverlayProps} props
 * @return {*}
 */
const StyledDataGridOverlay: React.FC<IStyledDataGridOverlayProps> = (props) => {
  return (
    <Box
      sx={{
        width: '100%',
        height: DATA_GRID_OVERLAY_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        px: 2
      }}>
      <Typography variant="body2" align="center" color="text.secondary">
        {props.message || 'No records to display'}
      </Typography>
      {props.action}
    </Box>
  );
};

export default StyledDataGridOverlay;
