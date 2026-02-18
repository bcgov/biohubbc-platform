import { ITicketStatusHistory } from 'interfaces/useTicketsApi.interface';
import { TicketStatusTimeline } from '../components/TicketStatusTimeline';

interface ITicketTimelineProps {
  history: ITicketStatusHistory[];
  isLoading: boolean;
}

/**
 * Renders the timeline section for a ticket.
 *
 * @param {ITicketTimelineProps} props
 * @return {*}
 */
export const TicketTimeline = (props: ITicketTimelineProps) => {
  const { history, isLoading } = props;

  return <TicketStatusTimeline history={history} isLoading={isLoading} />;
};
