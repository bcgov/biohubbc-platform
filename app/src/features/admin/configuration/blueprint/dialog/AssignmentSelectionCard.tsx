import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

/**
 * Display a selected definition with an accessible removal action.
 *
 * @param props Definition label and Formik removal callback.
 * @returns Selected assignment card.
 */
export const AssignmentSelectionCard = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <Paper
    variant="outlined"
    sx={{ p: 2, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
    <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
    <IconButton size="small" aria-label={`Remove ${label}`} onClick={onRemove}>
      <Icon path={mdiClose} size={0.65} />
    </IconButton>
  </Paper>
);
