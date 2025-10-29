import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface QuarantinedSubmissionsCardActionProps {
  label: string;
  onClick: () => void;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info';
}

/**
 * Generic action button used for quarantined submissions
 */
const QuarantinedSubmissionsCardAction = ({
  label,
  onClick,
  variant = 'contained',
  color = 'primary'
}: QuarantinedSubmissionsCardActionProps) => {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Button
        onClick={onClick}
        variant={variant}
        color={color}
        size="small"
        sx={{
          textTransform: 'none',
          borderRadius: '4px',
          fontWeight: 600
        }}>
        <Typography variant="button" fontSize="0.8rem">
          {label}
        </Typography>
      </Button>
    </Stack>
  );
};

export default QuarantinedSubmissionsCardAction;
