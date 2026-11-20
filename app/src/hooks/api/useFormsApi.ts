import { AxiosInstance } from 'axios';
import {
  IContributorCodesetCodesResponse,
  IContributorCodesetsResponse
} from 'interfaces/useContributorsApi.interface';
import {
  FormSubmissionUploadDecision,
  ICreateForm,
  IFormFilters,
  IFormSubmissionData,
  IFormSubmissionDetail,
  IFormSubmissionsResponse,
  IFormsResponse,
  IFormTeamsResponse,
  IFormVersionLayout,
  ISaveFormVersion
} from 'interfaces/useFormsApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Forms API operations: administration of forms, and the published form submitters fill in.
 *
 * @param axios Authenticated HTTP client.
 * @returns Explicit resource operations.
 */
export const useFormsApi = (axios: AxiosInstance) => {
  /**
   * Retrieve a filtered page of active forms, each with its latest version.
   *
   * @param filters Keyword filter.
   * @param pagination Server pagination.
   * @param options Optional request signal.
   * @returns Forms and pagination metadata.
   */
  const getForms = async (
    filters: IFormFilters,
    pagination: ApiPaginationRequestOptions,
    options?: { signal?: AbortSignal }
  ): Promise<IFormsResponse> => {
    const { data } = await axios.get('/api/administrative/forms', {
      params: { ...filters, ...pagination },
      signal: options?.signal
    });
    return data;
  };

  /**
   * Create a form, addressed by its slug, with a draft first version.
   *
   * @param payload Slug, form metadata and the layout of the first version.
   * @returns The created form version layout.
   */
  const createForm = async (payload: ICreateForm): Promise<IFormVersionLayout> => {
    const { data } = await axios.post('/api/administrative/forms', payload);
    return data;
  };

  /**
   * Retrieve a form version and its complete layout.
   *
   * @param formId Owning form.
   * @param formVersionId Form version identifier.
   * @param options Optional request signal.
   * @returns The form version layout.
   */
  const getFormVersion = async (
    formId: number,
    formVersionId: number,
    options?: { signal?: AbortSignal }
  ): Promise<IFormVersionLayout> => {
    const { data } = await axios.get(`/api/administrative/forms/${formId}/versions/${formVersionId}`, {
      signal: options?.signal
    });
    return data;
  };

  /**
   * Replace the form metadata and complete layout of a draft form version.
   *
   * @param formId Owning form.
   * @param formVersionId Draft form version identifier.
   * @param payload Form metadata and complete layout.
   * @returns The saved form version layout.
   */
  const updateFormVersion = async (
    formId: number,
    formVersionId: number,
    payload: ISaveFormVersion
  ): Promise<IFormVersionLayout> => {
    const { data } = await axios.put(`/api/administrative/forms/${formId}/versions/${formVersionId}`, payload);
    return data;
  };

  /**
   * Revise a published form: create a draft version copied from the published one.
   *
   * @param formId Form being revised.
   * @returns The new draft version layout.
   */
  const createFormVersion = async (formId: number): Promise<IFormVersionLayout> => {
    const { data } = await axios.post(`/api/administrative/forms/${formId}/versions`);
    return data;
  };

  /**
   * Publish a draft form version and its blueprint, retiring the previously published version.
   *
   * @param formId Owning form.
   * @param formVersionId Draft form version identifier.
   * @returns The published form version layout.
   */
  const publishFormVersion = async (formId: number, formVersionId: number): Promise<IFormVersionLayout> => {
    const { data } = await axios.post(`/api/administrative/forms/${formId}/versions/${formVersionId}/publish`);
    return data;
  };

  /**
   * Retrieve the teams whose members may access a form that is not public.
   *
   * @param formId Form identifier.
   * @param options Optional request signal.
   * @returns Linked teams.
   */
  const getFormTeams = async (formId: number, options?: { signal?: AbortSignal }): Promise<IFormTeamsResponse> => {
    const { data } = await axios.get(`/api/administrative/forms/${formId}/teams`, { signal: options?.signal });
    return data;
  };

  /**
   * Replace the teams whose members may access a form that is not public.
   *
   * @param formId Form identifier.
   * @param teamIds Every team to link.
   * @returns Linked teams.
   */
  const updateFormTeams = async (formId: number, teamIds: string[]): Promise<IFormTeamsResponse> => {
    const { data } = await axios.put(`/api/administrative/forms/${formId}/teams`, { teamIds });
    return data;
  };

  /**
   * Retrieve the published version of the form addressed by a slug.
   *
   * @param slug Form slug.
   * @param options Optional request signal.
   * @returns The published form version layout.
   */
  const getFormBySlug = async (slug: string, options?: { signal?: AbortSignal }): Promise<IFormVersionLayout> => {
    const { data } = await axios.get(`/api/forms/${slug}`, { signal: options?.signal });
    return data;
  };

  /**
   * List a page of the codesets of the form's contributor: the codes its code fields accept.
   *
   * @param slug Form slug.
   * @param pagination Server pagination.
   * @param options Optional request signal.
   * @returns Codesets and pagination metadata.
   */
  const getFormCodesets = async (
    slug: string,
    pagination: ApiPaginationRequestOptions,
    options?: { signal?: AbortSignal }
  ): Promise<IContributorCodesetsResponse> => {
    const { data } = await axios.get(`/api/forms/${slug}/codesets`, { params: pagination, signal: options?.signal });
    return data;
  };

  /**
   * List a page of the codes of one of the form's codesets.
   *
   * @param slug Form slug.
   * @param contributorCodesetId Codeset whose codes are listed.
   * @param pagination Server pagination.
   * @param options Optional request signal.
   * @returns Codes and pagination metadata.
   */
  const getFormCodesetCodes = async (
    slug: string,
    contributorCodesetId: number,
    pagination: ApiPaginationRequestOptions,
    options?: { signal?: AbortSignal }
  ): Promise<IContributorCodesetCodesResponse> => {
    const { data } = await axios.get(`/api/forms/${slug}/codesets/${contributorCodesetId}/codes`, {
      params: pagination,
      signal: options?.signal
    });
    return data;
  };

  /**
   * List a page of a form's submissions: all of them for a form administrator, the caller's own otherwise.
   *
   * @param slug Form slug.
   * @param pagination Server pagination.
   * @param options Optional request signal.
   * @returns Form submissions and pagination metadata.
   */
  const getFormSubmissions = async (
    slug: string,
    pagination: ApiPaginationRequestOptions,
    options?: { signal?: AbortSignal }
  ): Promise<IFormSubmissionsResponse> => {
    const { data } = await axios.get(`/api/forms/${slug}/submissions`, { params: pagination, signal: options?.signal });
    return data;
  };

  /**
   * Start a submission of the published form.
   *
   * @param slug Form slug.
   * @returns The new empty draft.
   */
  const createFormSubmission = async (slug: string): Promise<IFormSubmissionDetail> => {
    const { data } = await axios.post(`/api/forms/${slug}/submissions`);
    return data;
  };

  /**
   * Retrieve a form submission and its latest submit.
   *
   * @param slug Form slug.
   * @param formSubmissionUuid Form submission identifier.
   * @param options Optional request signal.
   * @returns The form submission.
   */
  const getFormSubmission = async (
    slug: string,
    formSubmissionUuid: string,
    options?: { signal?: AbortSignal }
  ): Promise<IFormSubmissionDetail> => {
    const { data } = await axios.get(`/api/forms/${slug}/submissions/${formSubmissionUuid}`, {
      signal: options?.signal
    });
    return data;
  };

  /**
   * Replace a form submission's draft. Editing a submitted form submission returns it to draft.
   *
   * @param slug Form slug.
   * @param formSubmissionUuid Form submission identifier.
   * @param payload Draft document.
   * @returns The saved form submission.
   */
  const updateFormSubmission = async (
    slug: string,
    formSubmissionUuid: string,
    payload: IFormSubmissionData
  ): Promise<IFormSubmissionDetail> => {
    const { data } = await axios.put(`/api/forms/${slug}/submissions/${formSubmissionUuid}`, { data: payload });
    return data;
  };

  /**
   * Submit a form submission's draft. Its upload is processed asynchronously.
   *
   * @param slug Form slug.
   * @param formSubmissionUuid Form submission identifier.
   * @returns The submitted form submission.
   */
  const submitFormSubmission = async (slug: string, formSubmissionUuid: string): Promise<IFormSubmissionDetail> => {
    const { data } = await axios.post(`/api/forms/${slug}/submissions/${formSubmissionUuid}/submit`);
    return data;
  };

  /**
   * Record a form administrator's review decision on one of a form submission's uploads.
   *
   * @param slug Form slug.
   * @param formSubmissionUuid Form submission identifier.
   * @param submissionUploadId Upload being reviewed.
   * @param decision Requested decision.
   * @returns The persisted decision; approving while the approval is applied.
   */
  const updateFormSubmissionUploadDecision = async (
    slug: string,
    formSubmissionUuid: string,
    submissionUploadId: string,
    decision: FormSubmissionUploadDecision
  ): Promise<{ submission_upload_id: string; decision: string }> => {
    const { data } = await axios.patch(
      `/api/forms/${slug}/submissions/${formSubmissionUuid}/uploads/${submissionUploadId}/status`,
      { decision }
    );
    return data;
  };

  return {
    getForms,
    createForm,
    getFormVersion,
    updateFormVersion,
    createFormVersion,
    publishFormVersion,
    getFormTeams,
    updateFormTeams,
    getFormBySlug,
    getFormCodesets,
    getFormCodesetCodes,
    getFormSubmissions,
    createFormSubmission,
    getFormSubmission,
    updateFormSubmission,
    submitFormSubmission,
    updateFormSubmissionUploadDecision
  };
};
