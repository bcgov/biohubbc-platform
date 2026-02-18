import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { Card, IconButton, Stack, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';

interface CartFeatureCardProps {
  label?: string;
  onRemove?: () => void;
}

export const CartFeatureCard = ({ label, onRemove }: CartFeatureCardProps) => {
  return (
    <Card variant="outlined" sx={{ width: 1, backgroundColor: grey[50] }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, py: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <IconButton size="small" onClick={onRemove} disabled={!onRemove} title="Remove from Cart">
          <Icon path={mdiClose} size={0.8} />
        </IconButton>
      </Stack>
    </Card>
  );
};
