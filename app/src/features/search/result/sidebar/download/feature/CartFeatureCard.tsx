import { mdiClose, mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import { Card, IconButton, Stack, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';

interface CartFeatureCardProps {
  label?: string;
  secured?: boolean;
  onRemove?: () => void;
}

export const CartFeatureCard = ({ label, secured, onRemove }: CartFeatureCardProps) => {
  return (
    <Card variant="outlined" sx={{ width: 1, backgroundColor: grey[50] }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, py: 0.5 }}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {secured && <Icon path={mdiLock} size={0.75} color="#d32f2f" data-testid="secured-icon" />}
          <Typography variant="body2">{label}</Typography>
        </Stack>
        <IconButton size="small" onClick={onRemove} disabled={!onRemove} title="Remove from Cart">
          <Icon path={mdiClose} size={0.8} />
        </IconButton>
      </Stack>
    </Card>
  );
};
