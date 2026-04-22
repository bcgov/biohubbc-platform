import { TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import yup from 'utils/YupSchema';

export const TicketAssigneeDialogYup = yup.object().shape({
  assignees: yup
    .array()
    .of(
      yup.object().shape({
        system_user_id: yup.number().required(),
        user_identifier: yup.string().required(),
        status: yup.mixed<TicketSystemUserStatus>().oneOf(['requested', 'started', 'blocked', 'resolved']).required()
      })
    )
    .min(1, 'At least one assignee is required')
    .required('At least one assignee is required')
});
