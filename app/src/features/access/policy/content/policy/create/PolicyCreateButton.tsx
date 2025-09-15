import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { useState } from 'react';
import { PolicyCreateDialog } from './dialog/PolicyCreateDialog';

export const PolicyCreateButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="contained"
        startIcon={<Icon path={mdiPlus} size={1} />}
        onClick={() => setOpen(true)}
        sx={{ mt: -2, fontWeight: 700 }}
      >
        Add Policy
      </Button>

      <PolicyCreateDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
};
