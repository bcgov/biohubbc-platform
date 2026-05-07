import * as yup from 'yup';

export const TicketCommentEditFormYupSchema = yup.object().shape({
  comment: yup.string().trim().required('Comment is required').max(3000, 'Comment must be 3000 characters or less')
});
