import Timeline from '@mui/lab/Timeline';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import Box from '@mui/material/Box';
import { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { ReactNode } from 'react';

export interface ICustomTimelineItem {
  id: string;
  content: ReactNode;
  icon?: ReactNode;
  rightContent?: ReactNode;
}

interface ICustomTimelineProps {
  items: ICustomTimelineItem[];
  dotSx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
  sx?: SxProps<Theme>;
  dataTestId?: string;
}

/**
 * Generic vertical timeline with connected events.
 *
 * @param {ICustomTimelineProps} props
 * @return {*}
 */
export const CustomTimeline = (props: ICustomTimelineProps) => {
  const { items, dotSx, contentSx, sx, dataTestId } = props;

  if (!items.length) {
    return null;
  }

  return (
    <Timeline
      data-testid={dataTestId}
      sx={{
        m: 0,
        p: 0,
        '& .MuiTimelineItem-root:before': {
          flex: 0,
          p: 0
        },
        ...sx
      }}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <TimelineItem key={item.id}>
            <TimelineSeparator>
              <TimelineDot
                sx={{
                  bgcolor: 'grey.100',
                  color: 'text.secondary',
                  boxShadow: 'none',
                  m: 0,
                  width: 42,
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...dotSx
                }}>
                {item.icon}
              </TimelineDot>
              {!isLast ? <TimelineConnector sx={{ bgcolor: 'divider', width: 2 }} /> : null}
            </TimelineSeparator>
            <TimelineContent sx={{ py: 1.25, px: 2.5, ...contentSx }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>{item.content}</Box>
                {item.rightContent ? (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {item.rightContent}
                  </Typography>
                ) : null}
              </Box>
            </TimelineContent>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
};
