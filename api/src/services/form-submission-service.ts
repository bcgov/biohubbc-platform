import dayjs from 'dayjs';
import { v4 } from 'uuid';
import { FORM_SUBMISSION_MAX_SECTION_ROWS, FORM_SUBMISSION_SORT_FIELDS } from '../constants/form';
import { IDBConnection } from '../database/db';
import { ApiConflictError, ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { FormFieldRow, FormVersionLayout } from '../models/form';
import {
  FormSubmission,
  FormSubmissionData,
  FormSubmissionDetail,
  FormSubmissionValue
} from '../models/form-submission';
import { IFlattenedBlock } from '../models/submission-feature';
import { SubmissionUploadDecisionResult, UpdateSubmissionUploadDecision } from '../models/submission-upload-decision';
import { UploadStatusEnum } from '../models/upload';
import { publishProcessSubmissionFeaturesJob } from '../queue/publisher';
import { FormSubmissionRepository } from '../repositories/form-submission-repository';
import { FormSubmissionUploadRepository } from '../repositories/form-submission-upload-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { TeamService } from './access-policy/team-service';
import { TeamAuthorizationService } from './authorization/team-authorization-service';
import { ContributorCodesetService } from './contributor-codeset-service';
import { DBService } from './db-service';
import { FormService } from './form-service';
import { SubmissionService } from './submission-service';
import { TicketService } from './ticket-service';
import { SubmissionUploadService } from './upload/submission-upload-service';
import { UploadService } from './upload/upload-service';

/**
 * Own form submissions: the drafts submitters fill in, submitting them, and reviewing what was submitted.
 *
 * A form has many form submissions, one per filled-in form. Each form submission becomes one `submission` on its
 * first submit, owned by the form's contributor. Every submit, including a resubmit after a revision, creates a new
 * `submission_upload` under that submission, so the previous upload is superseded and reconciliation compares the two
 * by each row's stable source identifier. A submit does not build a tarball: its features are stored with the upload
 * and the processing job ingests them directly. A form submission's team may edit and submit it; the form
 * administration team reviews it.
 *
 * @export
 * @class FormSubmissionService
 * @extends {DBService}
 */
export class FormSubmissionService extends DBService {
  formSubmissionRepository: FormSubmissionRepository;
  formSubmissionUploadRepository: FormSubmissionUploadRepository;
  formService: FormService;
  submissionService: SubmissionService;
  submissionUploadService: SubmissionUploadService;
  uploadService: UploadService;
  ticketService: TicketService;
  teamService: TeamService;
  teamAuthorizationService: TeamAuthorizationService;
  contributorCodesetService: ContributorCodesetService;

  /** Mutable dependency bag used by tests to stub queue publication under ESM. */
  static readonly dependencies = {
    publishProcessSubmissionFeaturesJob
  };

  constructor(connection: IDBConnection) {
    super(connection);
    this.formSubmissionRepository = new FormSubmissionRepository(connection);
    this.formSubmissionUploadRepository = new FormSubmissionUploadRepository(connection);
    this.formService = new FormService(connection);
    this.submissionService = new SubmissionService(connection);
    this.submissionUploadService = new SubmissionUploadService(connection);
    this.uploadService = new UploadService(connection);
    this.ticketService = new TicketService(connection);
    this.teamService = new TeamService(connection);
    this.teamAuthorizationService = new TeamAuthorizationService(connection);
    this.contributorCodesetService = new ContributorCodesetService(connection);
  }

  /**
   * Start a form submission of the published form addressed by a slug. The caller becomes the only member of its
   * team.
   *
   * @param {string} slug - Form slug.
   * @return {Promise<FormSubmissionDetail>} The new empty draft.
   * @throws {ApiNotFoundError} If no active form uses the slug, or the form has no published version.
   * @memberof FormSubmissionService
   */
  async createFormSubmission(slug: string): Promise<FormSubmissionDetail> {
    const layout = await this.formService.getPublishedFormBySlug(slug);
    const team = await this.teamService.createTeam({
      name: `Form Submission Team ${layout.form.slug}`,
      description: `Auto-generated team for a submission of form ${layout.form.slug}.`,
      system_user_ids: [this.connection.systemUserId()]
    });
    const formSubmission = await this.formSubmissionRepository.insertFormSubmission({
      formId: layout.form.form_id,
      formVersionId: layout.form_version.form_version_id,
      teamId: team.team_id,
      data: { sections: [] }
    });

    return this.getFormSubmission(slug, formSubmission.uuid);
  }

  /**
   * Get a form submission with the caller's relationship to it and its latest submit.
   *
   * @param {string} slug - Form slug.
   * @param {string} formSubmissionUuid - Form submission identifier.
   * @return {Promise<FormSubmissionDetail>} The form submission.
   * @throws {ApiNotFoundError} If the form or the form submission within it does not exist.
   * @memberof FormSubmissionService
   */
  async getFormSubmission(slug: string, formSubmissionUuid: string): Promise<FormSubmissionDetail> {
    const form = await this.formService.getFormBySlug(slug);
    const formSubmission = await this.getActiveFormSubmission(form.form_id, formSubmissionUuid);
    const systemUserId = this.connection.systemUserId();
    const isOwner = await this.teamAuthorizationService.isUserAuthorizedForTeamEntity(systemUserId, {
      entity: 'form_submission',
      formSubmissionUuid
    });
    const isFormAdmin = await this.isFormAdmin(slug);
    const latestUpload = await this.formSubmissionUploadRepository.getLatestFormSubmissionUpload(
      formSubmission.form_submission_id
    );

    return {
      form_submission: formSubmission,
      is_owner: isOwner,
      is_form_admin: isFormAdmin,
      latest_upload: latestUpload ?? null
    };
  }

  /**
   * List a page of a form's submissions: every submission for a form administrator, and only the caller's own
   * otherwise.
   *
   * @param {string} slug - Form slug.
   * @param {ApiPaginationOptions} pagination - Requested page and sorting.
   * @return {*} Form submissions, whether the caller administers the form, and pagination metadata.
   * @throws {ApiNotFoundError} If no active form uses the slug.
   * @throws {ApiValidationError} If the sort field is not supported.
   * @memberof FormSubmissionService
   */
  async getFormSubmissions(slug: string, pagination: ApiPaginationOptions) {
    if (!FORM_SUBMISSION_SORT_FIELDS.includes(pagination.sort ?? 'create_date')) {
      throw new ApiValidationError('Unsupported form submission sort field');
    }

    const form = await this.formService.getFormBySlug(slug);
    const isFormAdmin = await this.isFormAdmin(slug);
    const filters = { teamMemberSystemUserId: isFormAdmin ? null : this.connection.systemUserId() };
    const formSubmissions = await this.formSubmissionRepository.getFormSubmissions(form.form_id, filters, pagination);
    const count = await this.formSubmissionRepository.getFormSubmissionsCount(form.form_id, filters);

    return {
      form_submissions: formSubmissions,
      is_form_admin: isFormAdmin,
      pagination: makePaginationResponse(count.count, pagination)
    };
  }

  /**
   * Replace a form submission's draft. Saving the same draft again leaves it unchanged. Editing a submitted form
   * submission returns it to draft, which is how it is revised. The draft is checked against the form's current
   * published version, which it is then saved against; completeness is only required on submit.
   *
   * @param {string} slug - Form slug.
   * @param {string} formSubmissionUuid - Form submission identifier.
   * @param {FormSubmissionData} data - Draft document.
   * @return {Promise<FormSubmissionDetail>} The saved form submission.
   * @throws {ApiNotFoundError} If the form, its published version, or the form submission does not exist.
   * @throws {ApiValidationError} If a value is not a string, number, boolean or null, or the draft names sections or
   * fields the form does not have.
   * @memberof FormSubmissionService
   */
  async updateFormSubmission(
    slug: string,
    formSubmissionUuid: string,
    data: FormSubmissionData
  ): Promise<FormSubmissionDetail> {
    const parsed = FormSubmissionData.safeParse(data);

    if (!parsed.success) {
      throw new ApiValidationError('Every entered value must be a string, number, boolean or null', [
        { issues: parsed.error.issues.map((issue) => issue.path.join('.')) }
      ]);
    }

    const layout = await this.formService.getPublishedFormBySlug(slug);
    const formSubmission = await this.getActiveFormSubmission(layout.form.form_id, formSubmissionUuid);

    this.assertFormSubmissionDataMatchesLayout(layout, parsed.data);

    await this.formSubmissionRepository.updateFormSubmissionDraft(
      formSubmission.form_submission_id,
      layout.form_version.form_version_id,
      parsed.data
    );

    return this.getFormSubmission(slug, formSubmissionUuid);
  }

  /**
   * Submit a form submission's draft against the form's current published version.
   *
   * The first submit creates the submission, owned by the form's contributor. Every submit creates an upload pinned to
   * the published version's Blueprint, which supersedes the previous upload, stores the submitted features with it,
   * and queues their processing in the same transaction.
   *
   * @param {string} slug - Form slug.
   * @param {string} formSubmissionUuid - Form submission identifier.
   * @return {Promise<FormSubmissionDetail>} The submitted form submission.
   * @throws {ApiNotFoundError} If the form, its published version, or the form submission does not exist.
   * @throws {ApiConflictError} If the current draft has already been submitted.
   * @throws {ApiValidationError} If the draft is incomplete or invalid.
   * @memberof FormSubmissionService
   */
  async submitFormSubmission(slug: string, formSubmissionUuid: string): Promise<FormSubmissionDetail> {
    const layout = await this.formService.getPublishedFormBySlug(slug);
    const formSubmission = await this.formSubmissionRepository.getFormSubmissionForUpdate(
      layout.form.form_id,
      formSubmissionUuid
    );

    if (!formSubmission) {
      throw new ApiNotFoundError('Form submission not found');
    }

    if (formSubmission.status !== 'draft') {
      throw new ApiConflictError('The form submission has no changes to submit');
    }

    this.assertFormSubmissionDataMatchesLayout(layout, formSubmission.data);

    const codesets = await this.contributorCodesetService.getContributorCodesetsByContributorId(
      layout.form.contributor_id
    );
    const codesetKeyById = new Map(codesets.map((codeset) => [codeset.contributor_codeset_id, codeset.key]));
    const features = this.buildFormSubmissionFeatures(layout, formSubmission.data, codesetKeyById);
    const systemUserId = this.connection.systemUserId();
    const submissionId = await this.ensureFormSubmissionSubmission(layout, formSubmission, systemUserId);

    const { upload_id: uploadId } = await this.uploadService.insertUpload({
      upload_status: UploadStatusEnum.COMPLETED,
      record_end_date: dayjs().toISOString(),
      s3_upload_id: null
    });
    const ticket = await this.ticketService.createTicket({
      subject: 'New Form Submission',
      description: `Form: ${layout.form.name} (${layout.form.slug}). Form submission: ${formSubmission.uuid}. Submission ID: ${submissionId}. Upload UUID: ${uploadId}`,
      priority: 'medium',
      systemUserIds: [systemUserId]
    });
    const { submission_upload_id: submissionUploadId } = await this.submissionUploadService.insertSubmissionUpload(
      {
        submission_id: submissionId,
        upload_id: uploadId,
        ticket_id: ticket.ticket_id,
        status: 'uploaded',
        blueprint_id: layout.form_version.blueprint_id,
        comment: null
      },
      systemUserId
    );

    await this.formSubmissionUploadRepository.insertFormSubmissionUpload({
      submissionUploadId,
      formSubmissionId: formSubmission.form_submission_id,
      formVersionId: layout.form_version.form_version_id,
      data: formSubmission.data,
      features
    });
    await this.formSubmissionRepository.markFormSubmissionSubmitted(formSubmission.form_submission_id, submissionId);

    const submissionUpload = await this.submissionUploadService.getSubmissionUpload(submissionUploadId);

    // Published on this connection, so the job exists only if the submit commits.
    await FormSubmissionService.dependencies.publishProcessSubmissionFeaturesJob(this.connection, submissionUpload);

    return this.getFormSubmission(slug, formSubmissionUuid);
  }

  /**
   * Record a form administrator's review decision on one of a form submission's uploads, with the rules and the
   * asynchronous approval of every other upload review.
   *
   * @param {string} slug - Form slug.
   * @param {string} formSubmissionUuid - Form submission identifier.
   * @param {string} submissionUploadId - Upload being reviewed.
   * @param {UpdateSubmissionUploadDecision} data - Requested decision.
   * @return {Promise<SubmissionUploadDecisionResult>} Persisted decision; `approving` while an approval is queued.
   * @throws {ApiNotFoundError} If the form, the form submission, or the upload within it does not exist.
   * @memberof FormSubmissionService
   */
  async updateFormSubmissionUploadDecision(
    slug: string,
    formSubmissionUuid: string,
    submissionUploadId: string,
    data: UpdateSubmissionUploadDecision
  ): Promise<SubmissionUploadDecisionResult> {
    const form = await this.formService.getFormBySlug(slug);
    const formSubmission = await this.getActiveFormSubmission(form.form_id, formSubmissionUuid);
    const formSubmissionUpload = await this.formSubmissionUploadRepository.getFormSubmissionUpload(
      formSubmission.form_submission_id,
      submissionUploadId
    );

    if (!formSubmissionUpload) {
      throw new ApiNotFoundError('Form submission upload not found');
    }

    return this.submissionUploadService.updateSubmissionUploadDecision(submissionUploadId, data);
  }

  /**
   * Find the features a submission upload ingests, when the upload came from a form.
   *
   * @param {string} submissionUploadId - Submission upload identifier.
   * @return {Promise<IFlattenedBlock[] | null>} The submitted features, or null for a tarball upload.
   * @memberof FormSubmissionService
   */
  async findFormSubmissionUploadFeatures(submissionUploadId: string): Promise<IFlattenedBlock[] | null> {
    const formSubmissionUpload = await this.formSubmissionUploadRepository.findFormSubmissionUploadFeatures(
      submissionUploadId
    );

    return (formSubmissionUpload?.features as unknown as IFlattenedBlock[] | undefined) ?? null;
  }

  /**
   * Whether the caller administers the form addressed by a slug.
   *
   * @param {string} slug - Form slug.
   * @return {Promise<boolean>}
   * @memberof FormSubmissionService
   */
  private async isFormAdmin(slug: string): Promise<boolean> {
    return this.teamAuthorizationService.isUserAuthorizedForTeamEntity(this.connection.systemUserId(), {
      entity: 'form',
      formSlug: slug
    });
  }

  /**
   * Get an active form submission of a form or throw.
   *
   * @param {number} formId - Owning form.
   * @param {string} formSubmissionUuid - Form submission identifier.
   * @return {Promise<FormSubmission>} The form submission.
   * @throws {ApiNotFoundError} If the form submission does not exist within the form.
   * @memberof FormSubmissionService
   */
  private async getActiveFormSubmission(formId: number, formSubmissionUuid: string): Promise<FormSubmission> {
    const formSubmission = await this.formSubmissionRepository.getFormSubmission(formId, formSubmissionUuid);

    if (!formSubmission) {
      throw new ApiNotFoundError('Form submission not found');
    }

    return formSubmission;
  }

  /**
   * Get the submission a form submission became, creating it, owned by the form's contributor, on first submit.
   *
   * @param {FormVersionLayout} layout - Published form version being submitted against.
   * @param {FormSubmission} formSubmission - Form submission being submitted.
   * @param {number} systemUserId - Submitting user.
   * @return {Promise<number>} The submission identifier.
   * @memberof FormSubmissionService
   */
  private async ensureFormSubmissionSubmission(
    layout: FormVersionLayout,
    formSubmission: FormSubmission,
    systemUserId: number
  ): Promise<number> {
    if (formSubmission.submission_id !== null) {
      return formSubmission.submission_id;
    }

    const submission = await this.submissionService.insertSubmissionRecord({
      uuid: v4(),
      system_user_id: systemUserId,
      contributor_id: layout.form.contributor_id,
      name: layout.form.name,
      description: layout.form.description ?? '',
      comment: '',
      default_blueprint_id: layout.form_version.blueprint_id
    });

    return submission.submission_id;
  }

  /**
   * Require a draft to name only the sections and fields of a published form version, each section at most once, with
   * a unique source identifier per row and no more than the row limit.
   *
   * @param {FormVersionLayout} layout - Published form version.
   * @param {FormSubmissionData} data - Draft document.
   * @return {void}
   * @throws {ApiValidationError} If the draft does not match the layout.
   * @memberof FormSubmissionService
   */
  private assertFormSubmissionDataMatchesLayout(layout: FormVersionLayout, data: FormSubmissionData): void {
    const sectionByFeatureTypeId = new Map(layout.sections.map((section) => [section.feature_type_id, section]));
    const featureTypeIds = data.sections.map((sectionData) => sectionData.featureTypeId);
    const sourceIds = data.sections.flatMap((sectionData) => sectionData.rows.map((row) => row.sourceId));

    if (new Set(featureTypeIds).size !== featureTypeIds.length) {
      throw new ApiValidationError('A section can appear in a form submission only once');
    }

    if (new Set(sourceIds).size !== sourceIds.length) {
      throw new ApiValidationError('Every row of a form submission needs its own source identifier');
    }

    for (const sectionData of data.sections) {
      const section = sectionByFeatureTypeId.get(sectionData.featureTypeId);

      if (!section) {
        throw new ApiValidationError('The form submission names a section the form does not have', [
          { feature_type_id: sectionData.featureTypeId }
        ]);
      }

      if (sectionData.rows.length > FORM_SUBMISSION_MAX_SECTION_ROWS) {
        throw new ApiValidationError(`A section may have at most ${FORM_SUBMISSION_MAX_SECTION_ROWS} rows`, [
          { feature_type_id: sectionData.featureTypeId }
        ]);
      }

      const featurePropertyIds = new Set(section.fields.map((field) => String(field.feature_property_id)));
      const hasUnknownField = sectionData.rows.some((row) =>
        Object.keys(row.values).some((featurePropertyId) => !featurePropertyIds.has(featurePropertyId))
      );

      if (hasUnknownField) {
        throw new ApiValidationError('The form submission names a field the form does not have', [
          { feature_type_id: sectionData.featureTypeId }
        ]);
      }
    }
  }

  /**
   * Build the features a draft submits: one feature per row, identified by the row's source identifier, with its
   * values keyed by property name and typed for the property. Required sections need a row; sections that do not
   * allow multiple rows accept one. Unknown codes are left to ingestion, which resolves codes within the contributor.
   *
   * @param {FormVersionLayout} layout - Published form version being submitted against.
   * @param {FormSubmissionData} data - Draft document, already checked against the layout.
   * @param {Map<number, string>} codesetKeyById - Keys of the contributor's codesets.
   * @return {IFlattenedBlock[]} Features to ingest.
   * @throws {ApiValidationError} If the draft is incomplete, has too many rows, or has a value of the wrong type.
   * @memberof FormSubmissionService
   */
  private buildFormSubmissionFeatures(
    layout: FormVersionLayout,
    data: FormSubmissionData,
    codesetKeyById: Map<number, string>
  ): IFlattenedBlock[] {
    const errors: string[] = [];
    const features: IFlattenedBlock[] = [];

    for (const section of layout.sections) {
      const sectionData = data.sections.find((item) => item.featureTypeId === section.feature_type_id);
      const rows = sectionData?.rows ?? [];

      if (section.required_value && rows.length === 0) {
        errors.push(`${section.label} needs at least one row`);
      }

      if (!section.allow_multiple && rows.length > 1) {
        errors.push(`${section.label} accepts only one row`);
      }

      rows.forEach((row, rowIndex) => {
        const properties: Record<string, unknown> = {};

        for (const field of section.fields) {
          const value = this.toFeaturePropertyValue(
            field,
            row.values[String(field.feature_property_id)] ?? null,
            codesetKeyById
          );

          if (value instanceof Error) {
            errors.push(`${section.label} row ${rowIndex + 1}: ${value.message}`);
          } else if (value !== undefined) {
            properties[field.feature_property_name] = value;
          }
        }

        features.push({
          id: row.sourceId,
          type: section.feature_type_name,
          properties,
          content: [],
          parent: null
        });
      });
    }

    if (errors.length) {
      throw new ApiValidationError('The form submission is incomplete or invalid', errors);
    }

    if (!features.length) {
      throw new ApiValidationError('Add at least one row before submitting');
    }

    return features;
  }

  /**
   * Convert an entered value to the value its property type stores. An empty value is omitted.
   *
   * @param {FormFieldRow} field - Field the value was entered in.
   * @param {FormSubmissionValue} value - Entered value.
   * @param {Map<number, string>} codesetKeyById - Keys of the contributor's codesets.
   * @return {unknown | Error | undefined} The typed value, an error describing an invalid value, or undefined when
   * empty.
   * @memberof FormSubmissionService
   */
  private toFeaturePropertyValue(
    field: FormFieldRow,
    value: FormSubmissionValue,
    codesetKeyById: Map<number, string>
  ): unknown {
    if (value === null || value === '') {
      return undefined;
    }

    switch (field.type_name) {
      case FEATURE_PROPERTY_TYPE.NUMBER: {
        const number = Number(value);
        const isNumber = typeof value !== 'boolean' && Number.isFinite(number);
        return isNumber ? number : new Error(`${field.label} must be a number`);
      }
      case FEATURE_PROPERTY_TYPE.BOOLEAN:
        return typeof value === 'boolean' ? value : new Error(`${field.label} must be true or false`);
      case FEATURE_PROPERTY_TYPE.DATETIME: {
        const timestamp = dayjs(String(value));
        return typeof value === 'string' && timestamp.isValid()
          ? timestamp.toISOString()
          : new Error(`${field.label} must be a date and time`);
      }
      case FEATURE_PROPERTY_TYPE.CODE: {
        const codesetKey = codesetKeyById.get(field.contributor_codeset_id ?? -1);
        const prefix = `code::${codesetKey}::`;
        const isCode =
          typeof value === 'string' &&
          codesetKey !== undefined &&
          value.startsWith(prefix) &&
          value.length > prefix.length;
        return isCode ? value : new Error(`${field.label} must be a code from its codeset`);
      }
      default:
        return typeof value === 'string' ? value.trim() || undefined : new Error(`${field.label} must be text`);
    }
  }
}
