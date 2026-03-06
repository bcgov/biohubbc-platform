import { TicketPriority } from 'interfaces/useTicketsApi.interface';
import yup from 'utils/YupSchema';

export const EditTicketFormYupSchema = yup.object().shape({
  subject: yup.string().required('Subject is required').max(100, 'Subject must be 100 characters or less'),
  description: yup.string().nullable().max(2000, 'Description must be 2000 characters or less'),
  priority: yup.mixed<TicketPriority>().required('Priority is required')
});
