import { mdiBug, mdiDotsVertical, mdiSkipNext } from '@mdi/js';
import Icon from '@mdi/react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { IconButtonMenu, IconButtonMenuItem } from 'components/button/IconButtonMenu';
import { SubmissionRecordWithQuarantine } from 'interfaces/useQuarantineApi.interface';

interface QuarantinedSubmissionsCardProps {
  record: SubmissionRecordWithQuarantine;
  onScan?: () => void;
  onSkipScan?: () => void;
}

export const QuarantinedSubmissionsCard = ({ record, onScan, onSkipScan }: QuarantinedSubmissionsCardProps) => {
  const menuItems: IconButtonMenuItem[] = [];

  if (onScan) {
    menuItems.push({
      label: 'Scan for Malware',
      icon: <Icon path={mdiBug} size={0.8} />,
      onClick: onScan
    });
  }

  if (onSkipScan) {
    menuItems.push({
      label: 'Skip Scan',
      icon: <Icon path={mdiSkipNext} size={0.8} />,
      onClick: onSkipScan
    });
  }

  return (
    <Card elevation={0}>
      <CardHeader
        title={
          <Typography
            variant="h4"
            component="h3"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
            {record.name}
          </Typography>
        }
        action={
          <>
            <Chip
              label={record.quarantine.status}
              size="small"
              color="default"
              sx={{
                my: '-2px',
                fontSize: '12px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                mr: 1
              }}
            />
            {menuItems.length > 0 && (
              <IconButtonMenu icon={<Icon path={mdiDotsVertical} size={0.9} />} menuItems={menuItems} />
            )}
          </>
        }
        sx={{
          pb: 1,
          '& .MuiCardHeader-action': {
            margin: 0,
            display: 'flex',
            alignItems: 'center'
          }
        }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            maxWidth: 800,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
          {record.description}
        </Typography>
      </CardContent>
    </Card>
  );
};
