import { Formik } from 'formik';
import { useApi } from 'hooks/useApi';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { AddTeamForm, AddTeamFormInitialValues, AddTeamFormYupSchema } from './AddTeamForm';

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const renderWithFormik = (initialValues = AddTeamFormInitialValues) => {
  return render(
    <Formik initialValues={initialValues} validationSchema={AddTeamFormYupSchema} onSubmit={vi.fn()}>
      <AddTeamForm />
    </Formik>
  );
};

describe('AddTeamForm', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => ({
      teams: {
        getAvailableUsers: vi.fn().mockResolvedValue({ users: [] })
      }
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all form fields', async () => {
    const { getByLabelText } = renderWithFormik();

    await waitFor(() => {
      expect(getByLabelText('Team Name *')).toBeVisible();
      expect(getByLabelText('Description')).toBeVisible();
      expect(getByLabelText('Team Members')).toBeVisible();
    });
  });

  it('renders with initial values', async () => {
    const initialValues = {
      name: 'Test Team',
      description: 'A test description',
      system_users: []
    };

    const { getByLabelText } = renderWithFormik(initialValues);

    await waitFor(() => {
      expect(getByLabelText('Team Name *')).toHaveValue('Test Team');
      expect(getByLabelText('Description')).toHaveValue('A test description');
    });
  });

  it('has correct initial values export', () => {
    expect(AddTeamFormInitialValues).toEqual({
      name: '',
      description: '',
      system_users: []
    });
  });

  describe('validation schema', () => {
    it('requires team name', async () => {
      const result = await AddTeamFormYupSchema.validate({ name: '', description: '', system_users: [] }).catch(
        (err) => err
      );

      expect(result.message).toBe('Team name is required');
    });

    it('enforces max length of 250 for team name', async () => {
      const longName = 'a'.repeat(251);
      const result = await AddTeamFormYupSchema.validate({
        name: longName,
        description: '',
        system_users: []
      }).catch((err) => err);

      expect(result.message).toBe('Team name must be 250 characters or less');
    });

    it('allows valid team name', async () => {
      const result = await AddTeamFormYupSchema.validate({
        name: 'Valid Team Name',
        description: '',
        system_users: []
      });

      expect(result.name).toBe('Valid Team Name');
    });

    it('enforces max length of 1000 for description', async () => {
      const longDescription = 'a'.repeat(1001);
      const result = await AddTeamFormYupSchema.validate({
        name: 'Team',
        description: longDescription,
        system_users: []
      }).catch((err) => err);

      expect(result.message).toBe('Description must be 1000 characters or less');
    });

    it('allows empty description', async () => {
      const result = await AddTeamFormYupSchema.validate({
        name: 'Team',
        description: '',
        system_users: []
      });

      expect(result.description).toBe('');
    });

    it('allows array of member user objects', async () => {
      const users = [
        { system_user_id: 1, user_identifier: 'alice', display_name: null },
        { system_user_id: 2, user_identifier: 'bob', display_name: null }
      ];
      const result = await AddTeamFormYupSchema.validate({
        name: 'Team',
        description: '',
        system_users: users
      });

      expect(result.system_users).toEqual(users);
    });
  });
});
