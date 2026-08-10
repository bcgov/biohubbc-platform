import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { MapSelection } from './map-selection';

export interface ISearchResultMapPopperProps {
  /**
   * The selected feature or cluster to describe.
   */
  selection: MapSelection;
  /**
   * Fired when the user selects `View feature` on an individual feature.
   */
  onViewFeature: () => void;
  /**
   * Fired when the user selects `Zoom in` on a cluster.
   */
  onZoomIn: () => void;
  /**
   * Fired when the user explicitly dismisses the popper.
   */
  onClose: () => void;
}

/**
 * Popper describing the selected map feature or cluster, anchored at the clicked position inside the map container.
 *
 * Purely presentational: what was selected, and what happens on its actions, is owned by the caller. The two
 * variants deliberately share one component so a selection change can never leave two poppers mounted.
 *
 * @param {ISearchResultMapPopperProps} props
 * @return {*}
 */
export const SearchResultMapPopper = (props: ISearchResultMapPopperProps) => {
  const { selection, onViewFeature, onZoomIn, onClose } = props;

  return (
    <Paper
      data-testid="search-result-map-popper"
      elevation={4}
      sx={{
        position: 'absolute',
        left: selection.point.x,
        top: selection.point.y,
        // Sit just above-right of the clicked pixel so the geometry stays visible under the cursor.
        transform: 'translate(12px, -50%)',
        zIndex: (theme) => theme.zIndex.tooltip,
        p: 1.5,
        minWidth: 180,
        maxWidth: 260
      }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          {selection.kind === 'feature' ? (
            <>
              <Typography variant="subtitle2">Feature {selection.submissionFeatureId}</Typography>
              <Typography variant="body2" color="text.secondary">
                Open this search result
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="subtitle2" data-testid="search-result-map-popper-count">
                {selection.featureCount.toLocaleString()} results
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Zoom in to explore this area
              </Typography>
            </>
          )}
        </Box>
        <IconButton size="small" aria-label="Close" onClick={onClose} data-testid="search-result-map-popper-close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ mt: 1 }}>
        {selection.kind === 'feature' ? (
          <Button variant="contained" size="small" onClick={onViewFeature}>
            View feature
          </Button>
        ) : (
          <Button variant="contained" size="small" onClick={onZoomIn}>
            Zoom in
          </Button>
        )}
      </Box>
    </Paper>
  );
};
