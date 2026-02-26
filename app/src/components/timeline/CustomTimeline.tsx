import Timeline from '@mui/lab/Timeline';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ReactNode } from 'react';

export interface ICustomTimelineItem {
  id: string;
  content: ReactNode;
  icon?: ReactNode;
  rightContent?: ReactNode;
  stretchToRightEdge?: boolean;
}

interface ICustomTimelineProps {
  items: ICustomTimelineItem[];
  dataTestId?: string;
}

/**
 * Generic vertical timeline with connected events.
 *
 * @param {ICustomTimelineProps} props
 * @return {*}
 */
export const CustomTimeline = (props: ICustomTimelineProps) => {
  const { items, dataTestId } = props;

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
        }
      }}>
      {items.map((item, index) => {
        const isLastItem = index === items.length - 1;

        return (
          <TimelineItem
            key={item.id}
            sx={{
              '&:not(:last-of-type)': {
                pb: 2
              }
            }}>
            <TimelineSeparator>
              <TimelineDot
                sx={{
                  bgcolor: 'grey.100',
                  color: 'text.secondary',
                  boxShadow: 'none',
                  m: 0,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                {item.icon}
              </TimelineDot>
              {!isLastItem ? <TimelineConnector sx={{ bgcolor: 'divider', width: 2, mb: -2 }} /> : null}
            </TimelineSeparator>
            <TimelineContent
              sx={{
                py: 0.5,
                pl: 2.5,
                pr: 0
              }}>
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
