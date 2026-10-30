import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DialogContextProvider } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { IFormSubmissionDetail, IFormVersionLayout } from 'interfaces/useFormsApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SystemUserAuthState, UnauthenticatedUserAuthState } from 'test-helpers/auth-helpers';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { FormSubmission } from './FormSubmission';

vi.mock('hooks/useApi');
vi.mock('hooks/useAuthStateContext');

const layout: IFormVersionLayout = {
  form: {
    form_id: 1,
    slug: 'caribou',
    contributor_id: 3,
    team_id: 'team-1',
    name: 'Caribou Survey',
    description: null,
    is_public: true,
    record_end_date: null
  },
  form_version: {
    form_version_id: 2,
    form_id: 1,
    blueprint_id: 4,
    version_number: 1,
    record_effective_date: '2026-10-29',
    record_end_date: null
  },
  sections: [
    {
      blueprint_feature_type_id: 10,
      feature_type_id: 100,
      feature_type_name: 'observation',
      feature_type_display_name: 'Observation',
      label: 'Sighting',
      description: null,
      required_value: true,
      allow_multiple: false,
      sort: 0,
      fields: [
        {
          blueprint_feature_type_property_id: 20,
          blueprint_feature_type_id: 10,
          feature_property_id: 200,
          feature_property_name: 'notes',
          feature_property_display_name: 'Notes',
          type_name: 'string',
          label: 'Notes',
          description: null,
          contributor_codeset_id: null,
          sort: 0
        }
      ]
    }
  ]
};

const makeDetail = (overrides: Partial<IFormSubmissionDetail> = {}): IFormSubmissionDetail => ({
  form_submission: {
    form_submission_id: 7,
    uuid: 'fs-1',
    form_id: 1,
    form_version_id: 2,
    team_id: 'team-2',
    submission_id: null,
    status: 'draft',
    data: { sections: [{ featureTypeId: 100, rows: [{ sourceId: 'row-1', values: { 200: 'draft notes' } }] }] },
    submitted_date: null,
    create_date: '2026-10-29',
    create_user: 9
  },
  is_owner: true,
  is_form_admin: false,
  latest_upload: null,
  ...overrides
});

const mockUseApi = {
  forms: {
    createFormSubmission: vi.fn(),
    updateFormSubmission: vi.fn(),
    submitFormSubmission: vi.fn(),
    updateFormSubmissionUploadDecision: vi.fn(),
    getFormCodesets: vi.fn()
  }
};

const renderSubmission = (detail: IFormSubmissionDetail | null) =>
  render(
    <DialogContextProvider>
      <MemoryRouter initialEntries={[detail ? '/forms/caribou/submissions/fs-1' : '/forms/caribou']}>
        <Routes>
          <Route path="/forms/caribou" element={<FormSubmission layout={layout} detail={detail} />} />
          <Route
            path="/forms/caribou/submissions/fs-1"
            element={detail ? <FormSubmission layout={layout} detail={detail} /> : <div data-testid="saved-page" />}
          />
        </Routes>
      </MemoryRouter>
    </DialogContextProvider>
  );

describe('FormSubmission', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    (useAuthStateContext as Mock).mockReturnValue(SystemUserAuthState);
    mockUseApi.forms.createFormSubmission.mockResolvedValue(makeDetail());
    mockUseApi.forms.updateFormSubmission.mockResolvedValue(makeDetail());
    mockUseApi.forms.submitFormSubmission.mockResolvedValue(
      makeDetail({ form_submission: { ...makeDetail().form_submission, status: 'submitted' } })
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('asks an anonymous user to sign in before saving', async () => {
    const signinRedirect = vi.fn();
    (useAuthStateContext as Mock).mockReturnValue({
      ...UnauthenticatedUserAuthState,
      auth: { ...UnauthenticatedUserAuthState.auth, signinRedirect }
    });
    const { getByRole } = renderSubmission(null);

    fireEvent.click(getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(signinRedirect).toHaveBeenCalled());
    expect(mockUseApi.forms.createFormSubmission).not.toHaveBeenCalled();
  });

  it('starts the form submission on first save, saves the rows and opens the saved submission', async () => {
    const { getByRole, getByLabelText, findByTestId } = renderSubmission(null);

    fireEvent.change(getByLabelText('Notes'), { target: { value: 'two cows' } });
    fireEvent.click(getByRole('button', { name: 'Save draft' }));

    expect(await findByTestId('saved-page')).toBeInTheDocument();
    expect(mockUseApi.forms.createFormSubmission).toHaveBeenCalledWith('caribou');
    const savedData = mockUseApi.forms.updateFormSubmission.mock.calls[0][2];
    expect(savedData.sections[0].featureTypeId).toEqual(100);
    expect(savedData.sections[0].rows[0].values).toEqual({ 200: 'two cows' });
    expect(mockUseApi.forms.submitFormSubmission).not.toHaveBeenCalled();
  });

  it('saves before submitting an existing form submission, keeping its row identifiers', async () => {
    const { getByRole } = renderSubmission(makeDetail());

    fireEvent.click(getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(mockUseApi.forms.submitFormSubmission).toHaveBeenCalledWith('caribou', 'fs-1'));
    expect(mockUseApi.forms.createFormSubmission).not.toHaveBeenCalled();
    expect(mockUseApi.forms.updateFormSubmission).toHaveBeenCalledWith('caribou', 'fs-1', {
      sections: [{ featureTypeId: 100, rows: [{ sourceId: 'row-1', values: { 200: 'draft notes' } }] }]
    });
  });

  it('shows a reviewer the latest submitted content read-only and records an approval', async () => {
    mockUseApi.forms.updateFormSubmissionUploadDecision.mockResolvedValue({
      submission_upload_id: 'su-1',
      decision: 'approving'
    });
    const detail = makeDetail({
      is_owner: false,
      is_form_admin: true,
      latest_upload: {
        submission_upload_id: 'su-1',
        status: 'indexed',
        decision: 'pending',
        data: { sections: [{ featureTypeId: 100, rows: [{ sourceId: 'row-1', values: { 200: 'submitted notes' } }] }] },
        create_date: '2026-10-29'
      }
    });
    const { getByRole, getByLabelText, queryByRole } = renderSubmission(detail);

    expect(getByLabelText('Notes')).toHaveValue('submitted notes');
    expect(getByLabelText('Notes')).toBeDisabled();
    expect(queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(mockUseApi.forms.updateFormSubmissionUploadDecision).toHaveBeenCalledWith(
        'caribou',
        'fs-1',
        'su-1',
        'approved'
      )
    );
  });

  it('offers no review actions to a submitter who does not administer the form', () => {
    const detail = makeDetail({
      latest_upload: {
        submission_upload_id: 'su-1',
        status: 'indexed',
        decision: 'pending',
        data: { sections: [] },
        create_date: '2026-10-29'
      }
    });
    const { queryByRole } = renderSubmission(detail);

    expect(queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument();
  });
});
