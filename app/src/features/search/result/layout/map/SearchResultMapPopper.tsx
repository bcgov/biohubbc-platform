import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export interface ISearchResultMapPopperProps {
  /**
   * How many results the selected cluster represents.
   */
  featureCount: number;
  /**
   * Fired when the user selects `Zoom in`.
   */
  onZoomIn: () => void;
  /**
   * Fired when the user explicitly dismisses the popper.
   */
  onClose: () => void;
}

/**
 * Describes the selected cluster.
 *
 * Content only: the map positions this, keeps it over its geography, and dismisses it. What it says, and what its
 * action does, is owned by the caller.
 *
 * @param {ISearchResultMapPopperProps} props
 * @return {*}
 */
export const SearchResultMapPopper = (props: ISearchResultMapPopperProps) => {
  const { featureCount, onZoomIn, onClose } = props;

  return (
    <Paper data-testid="search-result-map-popper" elevation={4} sx={{ p: 1.5, minWidth: 180, maxWidth: 260 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography variant="subtitle2" data-testid="search-result-map-popper-count">
            {featureCount.toLocaleString()} results
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Zoom in to explore this area
          </Typography>
        </Box>
        <IconButton size="small" aria-label="Close" onClick={onClose} data-testid="search-result-map-popper-close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ mt: 1 }}>
        <Button variant="contained" size="small" onClick={onZoomIn}>
          Zoom in
        </Button>
      </Box>
    </Paper>
  );
};
