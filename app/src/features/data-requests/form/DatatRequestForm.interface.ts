import yup from 'utils/YupSchema';

export const dataRequestFormYupSchema = yup.object().shape({
  reason: yup
    .string()
    .min(1, 'A reason is required')
    .max(2000, 'Cannot exceed 2000 characters')
    .required('A reason is required')
});

export interface IDataRequestFormValues {
  reason: string;
}

export const dataRequestFormInitialValues: IDataRequestFormValues = {
  reason: ''
};
