import { TicketRelationshipType } from 'interfaces/useTicketsApi.interface';
import yup from 'utils/YupSchema';

export const TicketReferenceFormYupSchema = yup.object().shape({
  source_ticket_id: yup.string().required(),
  relationship: yup.mixed<TicketRelationshipType>().required('Relationship is required'),
  target_ticket_ids: yup
    .array()
    .of(yup.string().uuid().required())
    .min(1, 'Target ticket is required')
    .required('Target ticket is required')
});
