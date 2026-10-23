import yup from 'utils/YupSchema';

export const BoardTicketAddYupSchema = yup.object().shape({
  ticketIds: yup
    .array()
    .of(yup.string().required())
    .min(1, 'Pick at least one ticket')
    .required('Pick at least one ticket')
});
