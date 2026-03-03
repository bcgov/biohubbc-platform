import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { PropsWithChildren, ReactNode } from 'react';

export interface IPageSectionProps extends PropsWithChildren {
  id: string;
  label: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  headerContent?: ReactNode;
}

/**
 * Reusable page section layout for admin list screens.
 *
 * Renders a titled paper section with a standardized Add button and
 * customizable header/children content.
 *
 * @param {IPageSectionProps} props
 * @returns {JSX.Element}
 */
export const PageSection = (props: IPageSectionProps) => {
  const { id, label, onAdd, addLabel = 'Add', headerContent, children } = props;

  return (
    <Paper>
      <Toolbar disableGutters sx={{ px: 2 }}>
        <Typography variant="h4" component="h2" flexGrow={1}>
          {label}
        </Typography>
        <Stack gap={1} direction="row" alignItems="center">
          {headerContent}
          {onAdd && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Icon path={mdiPlus} size={0.8} />}
              data-testid={`${id}-add-button`}
              onClick={onAdd}>
              {addLabel}
            </Button>
          )}
        </Stack>
      </Toolbar>

      <Divider flexItem />

      {children}
    </Paper>
  );
};
