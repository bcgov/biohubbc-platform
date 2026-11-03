import yup from 'utils/YupSchema';

export const BoardTagAddYupSchema = yup.object().shape({
  tagIds: yup.array().of(yup.string().required()).min(1, 'Pick at least one tag').required('Pick at least one tag')
});
