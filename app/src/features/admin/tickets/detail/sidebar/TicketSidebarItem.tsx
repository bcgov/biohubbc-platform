import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ReactNode } from 'react';

interface ITicketSidebarItemProps {
  label: ReactNode;
  href?: string;
  onRemove?: () => void;
  isDisabled?: boolean;
}

/**
 * Reusable sidebar item row with optional remove action.
 *
 * @param {ITicketSidebarItemProps} props
 * @return {*}
 */
export const TicketSidebarItem = (props: ITicketSidebarItemProps) => {
  const { label, href, onRemove, isDisabled } = props;

  return (
    <Card
      variant="outlined"
      sx={{
        p: 0.5,
        px: 2,
        backgroundColor: 'grey.50'
      }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        {href ? (
          <Link
            href={href}
            variant="body2"
            color="inherit"
            underline="hover"
            sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </Link>
        ) : (
          <Typography variant="body2" noWrap>
            {label}
          </Typography>
        )}
        {onRemove ? (
          <IconButton size="small" aria-label={`remove ${label}`} onClick={onRemove} disabled={isDisabled}>
            <Icon path={mdiClose} size={0.65} />
          </IconButton>
        ) : null}
      </Stack>
    </Card>
  );
};
