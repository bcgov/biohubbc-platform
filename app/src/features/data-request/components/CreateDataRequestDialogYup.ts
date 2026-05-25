import yup from 'utils/YupSchema';

export const CreateDataRequestDialogYup = yup.object().shape({
  reason: yup.string().trim().required('Reason is required').max(2000, 'Reason must be 2000 characters or less')
});
