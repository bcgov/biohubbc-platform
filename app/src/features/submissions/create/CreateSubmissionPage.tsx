import {
  secureDataAccessRequestFormInitialValues,
  secureDataAccessRequestFormYupSchema
} from 'features/datasets/security/SecureDataAccessRequestForm';
import { Formik } from 'formik';
import { useApi } from 'hooks/useApi';
import { ISubmissionFeature } from 'interfaces/useSubmissionsApi.interface';

interface ICreateSubmissionForm {
  features: ISubmissionFeature[];
}

export const CreateSubmissionPage = () => {
  const bioHubApi = useApi();

  const handleSubmit = (values: ICreateSubmissionForm) => {
    bioHubApi.submissions.createSubmission();
  };
  return (
    <Formik
      innerRef={formikRef}
      initialValues={secureDataAccessRequestFormInitialValues}
      validationSchema={secureDataAccessRequestFormYupSchema}
      validateOnBlur={true}
      validateOnChange={false}
      enableReinitialize={true}
      onSubmit={handleSubmit}>
      <CreateSubmissionForm />
    </Formik>
  );
};
