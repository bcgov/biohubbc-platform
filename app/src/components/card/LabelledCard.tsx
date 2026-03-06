import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ReactNode } from 'react';

interface ILabelledCardProps {
  label: ReactNode;
  action?: ReactNode;
}

/**
 * Generic card component for displaying a single label with an optional right-side action.
 *
 * @param {ILabelledCardProps} props
 * @return {*}
 */
export const LabelledCard = (props: ILabelledCardProps) => {
  const { label, action } = props;

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        backgroundColor: 'grey.50'
      }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" noWrap>
          {label}
        </Typography>
        {action}
      </Stack>
    </Card>
  );
};
