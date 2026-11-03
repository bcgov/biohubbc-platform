import yup from 'utils/YupSchema';

export const TicketTagDialogYup = yup.object().shape({
  tags: yup.array()
});
