import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export interface IStyledDataGridOverlayProps {
  message?: string;
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
        minHeight: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2
      }}>
      <Typography align="center" color="text.secondary">
        {props.message || 'No records to display'}
      </Typography>
    </Box>
  );
};

export default StyledDataGridOverlay;

