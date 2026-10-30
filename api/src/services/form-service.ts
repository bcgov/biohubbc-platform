import { FORM_SORT_FIELDS, FORM_SUPPORTED_PROPERTY_TYPES } from '../constants/form';
import { IDBConnection } from '../database/db';
import { ApiConflictError, ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import {
  BlueprintFeatureTypePropertyPair,
  EnsureBlueprintFeatureType,
  EnsureBlueprintFeatureTypeProperty
} from '../models/blueprint-composition';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import {
  CreateForm,
  Form,
  FormFilters,
  FormSection,
  FormTeam,
  FormVersion,
  FormVersionLayout,
  InsertFormField,
  InsertFormSection,
  SaveFormSection,
  SaveFormVersion
} from '../models/form';
import { FormRepository } from '../repositories/form-repository';
import { FormTeamRepository } from '../repositories/form-team-repository';
import { FormVersionFeatureTypePropertyRepository } from '../repositories/form-version-feature-type-property-repository';
import { FormVersionFeatureTypeRepository } from '../repositories/form-version-feature-type-repository';
import { FormVersionRepository } from '../repositories/form-version-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { TeamService } from './access-policy/team-service';
import { BlueprintFeatureTypePropertyService } from './blueprint-feature-type-property-service';
import { BlueprintFeatureTypeService } from './blueprint-feature-type-service';
import { BlueprintService } from './blueprint-service';
import { BlueprintVersionService } from './blueprint-version-service';
import { ContributorCodesetCodeService } from './contributor-codeset-code-service';
import { ContributorCodesetService } from './contributor-codeset-service';
import { ContributorService } from './contributor-service';
import { DBService } from './db-service';
import { FeaturePropertyService } from './feature-property-service';
import { FeatureTypeService } from './feature-type-service';

/**
 * Own forms, their versions, the presentation of each version's Blueprint, and access to forms.
 *
 * Every form version is joined to its own Blueprint. Saving a draft writes that Blueprint's composition through the
 * Blueprint services and then replaces the version's presentation. Revising a published form creates a new draft
 * version with a copy of the published Blueprint; publishing it retires the previous version and its Blueprint, so a
 * form has a single active Blueprint while its slug, and so its URL, stays the same. Every write first takes the
 * blueprint administration lock, which serializes form writes with all other Blueprint administration.
 *
 * A public form is open to anyone. Any other form requires an authenticated member of a team linked to it. Every form
 * belongs to a contributor, whose codesets are the only codes its code fields accept, and has an administration team
 * whose members review its submissions.
 *
 * @export
 * @class FormService
 * @extends {DBService}
 */
export class FormService extends DBService {
  formRepository: FormRepository;
  formVersionRepository: FormVersionRepository;
  formVersionFeatureTypeRepository: FormVersionFeatureTypeRepository;
  formVersionFeatureTypePropertyRepository: FormVersionFeatureTypePropertyRepository;
  formTeamRepository: FormTeamRepository;
  blueprintService: BlueprintService;
  blueprintVersionService: BlueprintVersionService;
  blueprintFeatureTypeService: BlueprintFeatureTypeService;
  blueprintFeatureTypePropertyService: BlueprintFeatureTypePropertyService;
  featureTypeService: FeatureTypeService;
  featurePropertyService: FeaturePropertyService;
  teamService: TeamService;
  contributorService: ContributorService;
  contributorCodesetService: ContributorCodesetService;
  contributorCodesetCodeService: ContributorCodesetCodeService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.formRepository = new FormRepository(connection);
    this.formVersionRepository = new FormVersionRepository(connection);
    this.formVersionFeatureTypeRepository = new FormVersionFeatureTypeRepository(connection);
    this.formVersionFeatureTypePropertyRepository = new FormVersionFeatureTypePropertyRepository(connection);
    this.formTeamRepository = new FormTeamRepository(connection);
    this.blueprintService = new BlueprintService(connection);
    this.blueprintVersionService = new BlueprintVersionService(connection);
    this.blueprintFeatureTypeService = new BlueprintFeatureTypeService(connection);
    this.blueprintFeatureTypePropertyService = new BlueprintFeatureTypePropertyService(connection);
    this.featureTypeService = new FeatureTypeService(connection);
    this.featurePropertyService = new FeaturePropertyService(connection);
    this.teamService = new TeamService(connection);
    this.contributorService = new ContributorService(connection);
    this.contributorCodesetService = new ContributorCodesetService(connection);
    this.contributorCodesetCodeService = new ContributorCodesetCodeService(connection);
  }

  /**
   * List active forms with their latest version and the filtered pagination count.
   *
   * @param {FormFilters} filters - Keyword filters.
   * @param {ApiPaginationOptions} pagination - Requested page and sorting.
   * @return {*} Form list and pagination metadata.
   * @throws {ApiValidationError} If the sort field is not supported.
   * @memberof FormService
   */
  async getForms(filters: FormFilters, pagination: ApiPaginationOptions) {
    if (!FORM_SORT_FIELDS.includes(pagination.sort ?? 'name')) {
      throw new ApiValidationError('Unsupported form sort field');
    }

    const forms = await this.formRepository.getForms(filters, pagination);
    const count = await this.formRepository.getFormsCount(filters);

    return { forms, pagination: makePaginationResponse(count.count, pagination) };
  }

  /**
   * Get a form version and its complete layout: its sections, and each section's fields, in display order.
   *
   * @param {number} formId - Owning form.
   * @param {number} formVersionId - Form version identifier.
   * @return {Promise<FormVersionLayout>} The form version layout.
   * @throws {ApiNotFoundError} If the form or the version within it does not exist.
   * @memberof FormService
   */
  async getFormVersionLayout(formId: number, formVersionId: number): Promise<FormVersionLayout> {
    const form = await this.getForm(formId);
    const formVersion = await this.getFormVersion(formId, formVersionId);
    const sectionRows = await this.formVersionFeatureTypeRepository.getFormSections(formVersionId);
    const fieldRows = await this.formVersionFeatureTypePropertyRepository.getFormFields(formVersionId);

    const sections: FormSection[] = sectionRows.map((sectionRow) => ({
      ...sectionRow,
      fields: fieldRows.filter(
        (fieldRow) => fieldRow.blueprint_feature_type_id === sectionRow.blueprint_feature_type_id
      )
    }));

    return { form, form_version: formVersion, sections };
  }

  /**
   * Get the published layout of the active form addressed by a slug: the version submitters fill in. Access is
   * checked by the `Form` authorization rule before this is called.
   *
   * @param {string} slug - Form slug.
   * @return {Promise<FormVersionLayout>} The active published version layout.
   * @throws {ApiNotFoundError} If no active form uses the slug, or the form has no published version.
   * @memberof FormService
   */
  async getPublishedFormBySlug(slug: string): Promise<FormVersionLayout> {
    const form = await this.getFormBySlug(slug);
    const formVersion = await this.formVersionRepository.getPublishedFormVersion(form.form_id);

    if (!formVersion) {
      throw new ApiNotFoundError('Form not found');
    }

    return this.getFormVersionLayout(form.form_id, formVersion.form_version_id);
  }

  /**
   * Check whether a request can access the form addressed by a slug.
   *
   * A public form is open to anyone, including anonymous requests. Any other form requires an authenticated member of
   * a team linked through form_team. A slug no active form uses is allowed through, so the request is answered with
   * not found rather than access denied.
   *
   * @param {string} slug - Form slug.
   * @param {number | null} systemUserId - The authenticated user's ID, or null if unauthenticated.
   * @return {Promise<boolean>}
   * @memberof FormService
   */
  async isUserAuthorizedForForm(slug: string, systemUserId: number | null): Promise<boolean> {
    const form = await this.formRepository.findActiveFormBySlug(slug);

    if (!form || form.is_public) {
      return true;
    }

    if (systemUserId === null) {
      return false;
    }

    return this.formTeamRepository.isUserAuthorizedForForm(form.form_id, systemUserId);
  }

  /**
   * Create a form, addressed by its slug and owned by a contributor, with an administration team and a draft first
   * version joined to a new draft Blueprint built from the layout. The creator is the first administrator.
   *
   * @param {CreateForm} data - Form metadata, slug, contributor and the layout of the first version.
   * @return {Promise<FormVersionLayout>} The created form version layout.
   * @throws {ApiNotFoundError} If the contributor does not exist.
   * @throws {ApiValidationError} If the layout is invalid.
   * @throws {ApiConflictError} If an active form already uses the slug.
   * @memberof FormService
   */
  async createForm(data: CreateForm): Promise<FormVersionLayout> {
    await this.contributorService.getAdministrativeContributor(data.contributorId);
    await this.validateFormSections(data.sections, data.contributorId);

    // Creating the Blueprint takes the blueprint administration lock before any other read or write.
    const blueprint = await this.blueprintService.createBlueprint({
      name: data.name,
      description: data.description,
      parentBlueprintId: null,
      recordEffectiveDate: null
    });

    const existingForm = await this.formRepository.findActiveFormBySlug(data.slug);

    if (existingForm) {
      throw new ApiConflictError('A form with this slug already exists');
    }

    const team = await this.teamService.createTeam({
      name: `Form Administrators ${data.slug}`,
      description: `Auto-generated administration team for form ${data.slug}.`,
      system_user_ids: [this.connection.systemUserId()]
    });
    const form = await this.formRepository.insertForm({
      slug: data.slug,
      contributorId: data.contributorId,
      teamId: team.team_id,
      name: data.name,
      description: data.description,
      isPublic: data.isPublic
    });
    const formVersion = await this.formVersionRepository.insertFormVersion(form.form_id, blueprint.blueprint_id);
    const date = await this.blueprintService.lockEditableBlueprint(blueprint.blueprint_id);

    await this.saveFormVersionLayout(formVersion, data.sections, date);

    return this.getFormVersionLayout(form.form_id, formVersion.form_version_id);
  }

  /**
   * Replace the form metadata and complete layout of a draft form version. Saving the same layout again leaves it
   * unchanged.
   *
   * @param {number} formId - Owning form.
   * @param {number} formVersionId - Draft form version identifier.
   * @param {SaveFormVersion} data - Form metadata and complete layout.
   * @return {Promise<FormVersionLayout>} The saved form version layout.
   * @throws {ApiValidationError} If the layout is invalid.
   * @throws {ApiNotFoundError} If the form or the version within it does not exist.
   * @throws {ApiConflictError} If the version is published or retired.
   * @memberof FormService
   */
  async updateFormVersion(formId: number, formVersionId: number, data: SaveFormVersion): Promise<FormVersionLayout> {
    const form = await this.getForm(formId);
    await this.validateFormSections(data.sections, form.contributor_id);

    const unlockedFormVersion = await this.getFormVersion(formId, formVersionId);

    // Lock before reading the version's lifecycle so the read cannot race a publish.
    const date = await this.blueprintService.lockEditableBlueprint(unlockedFormVersion.blueprint_id);
    const formVersion = await this.getFormVersion(formId, formVersionId);
    this.assertFormVersionIsDraft(formVersion);

    await this.formRepository.updateForm(formId, {
      name: data.name,
      description: data.description,
      isPublic: data.isPublic
    });
    await this.blueprintService.updateBlueprint(formVersion.blueprint_id, {
      name: data.name,
      description: data.description
    });

    await this.saveFormVersionLayout(formVersion, data.sections, date);

    return this.getFormVersionLayout(formId, formVersionId);
  }

  /**
   * Revise a published form: create a draft version joined to a new Blueprint copied from the published version's
   * Blueprint, with the published version's presentation. The published version stays active until the revision is
   * published.
   *
   * @param {number} formId - Form being revised.
   * @return {Promise<FormVersionLayout>} The new draft version layout.
   * @throws {ApiNotFoundError} If the form does not exist.
   * @throws {ApiConflictError} If the form has no published version, or already has a draft.
   * @memberof FormService
   */
  async createFormVersion(formId: number): Promise<FormVersionLayout> {
    await this.getForm(formId);

    const sourceFormVersion = await this.formVersionRepository.getPublishedFormVersion(formId);

    if (!sourceFormVersion) {
      throw new ApiConflictError('Only a published form can be revised');
    }

    // Creating the Blueprint version takes the blueprint administration lock before the draft check.
    const blueprint = await this.blueprintVersionService.createBlueprintVersion(sourceFormVersion.blueprint_id, {});
    const draftFormVersion = await this.formVersionRepository.getDraftFormVersion(formId);

    if (draftFormVersion) {
      throw new ApiConflictError('The form already has a draft version');
    }

    const formVersion = await this.formVersionRepository.insertFormVersion(formId, blueprint.blueprint_id);

    await this.formVersionFeatureTypeRepository.copyFormSections(
      sourceFormVersion.form_version_id,
      formVersion.form_version_id
    );
    await this.formVersionFeatureTypePropertyRepository.copyFormFields(
      sourceFormVersion.form_version_id,
      formVersion.form_version_id
    );

    return this.getFormVersionLayout(formId, formVersion.form_version_id);
  }

  /**
   * Publish a draft form version and its Blueprint. The previously published version and its Blueprint are retired,
   * so the form keeps a single active Blueprint. Neither the version nor its Blueprint can change afterwards.
   *
   * @param {number} formId - Owning form.
   * @param {number} formVersionId - Draft form version identifier.
   * @return {Promise<FormVersionLayout>} The published form version layout.
   * @throws {ApiNotFoundError} If the form or the version within it does not exist.
   * @throws {ApiConflictError} If the version is already published or retired.
   * @throws {ApiValidationError} If the version has no sections or a section has no fields.
   * @memberof FormService
   */
  async publishFormVersion(formId: number, formVersionId: number): Promise<FormVersionLayout> {
    const unlockedFormVersion = await this.getFormVersion(formId, formVersionId);

    await this.blueprintService.lockEditableBlueprint(unlockedFormVersion.blueprint_id);

    const layout = await this.getFormVersionLayout(formId, formVersionId);
    this.assertFormVersionIsDraft(layout.form_version);

    const isIncomplete = !layout.sections.length || layout.sections.some((section) => !section.fields.length);

    if (isIncomplete) {
      throw new ApiValidationError('A form needs at least one section, and every section at least one field');
    }

    const previousFormVersion = await this.formVersionRepository.getPublishedFormVersion(formId);

    // Retire the previous version first: a form has at most one active published version.
    if (previousFormVersion) {
      await this.formVersionRepository.retireFormVersion(previousFormVersion.form_version_id);
      await this.blueprintService.retireBlueprint(previousFormVersion.blueprint_id);
    }

    await this.blueprintService.publishBlueprint(layout.form_version.blueprint_id, { is_default: false });
    await this.formVersionRepository.publishFormVersion(formVersionId);

    return this.getFormVersionLayout(formId, formVersionId);
  }

  /**
   * Get the active form addressed by a slug. Access is checked by the `Form` authorization rule before this is called.
   *
   * @param {string} slug - Form slug.
   * @return {Promise<Form>} The active form.
   * @throws {ApiNotFoundError} If no active form uses the slug.
   * @memberof FormService
   */
  async getFormBySlug(slug: string): Promise<Form> {
    const form = await this.formRepository.findActiveFormBySlug(slug);

    if (!form) {
      throw new ApiNotFoundError('Form not found');
    }

    return form;
  }

  /**
   * List a page of the codesets of the contributor that owns the form addressed by a slug: the codes its code fields
   * accept.
   *
   * @param {string} slug - Form slug.
   * @param {ApiPaginationOptions} pagination - Requested page and sort.
   * @return {*} Codesets on the requested page and pagination metadata.
   * @throws {ApiNotFoundError} If no active form uses the slug.
   * @memberof FormService
   */
  async getFormCodesets(slug: string, pagination: ApiPaginationOptions) {
    const form = await this.getFormBySlug(slug);

    return this.contributorCodesetService.listAdministrativeContributorCodesets(form.contributor_id, pagination);
  }

  /**
   * List a page of the codes of one codeset of the contributor that owns the form addressed by a slug. A codeset of
   * another contributor has no codes.
   *
   * @param {string} slug - Form slug.
   * @param {number} contributorCodesetId - Codeset whose codes are listed.
   * @param {ApiPaginationOptions} pagination - Requested page and sort.
   * @return {*} Codes on the requested page and pagination metadata.
   * @throws {ApiNotFoundError} If no active form uses the slug.
   * @memberof FormService
   */
  async getFormCodesetCodes(slug: string, contributorCodesetId: number, pagination: ApiPaginationOptions) {
    const form = await this.getFormBySlug(slug);

    return this.contributorCodesetCodeService.listAdministrativeContributorCodesetCodes(
      { contributorId: form.contributor_id, contributorCodesetId },
      pagination
    );
  }

  /**
   * Get the teams whose members may access a form that is not public.
   *
   * @param {number} formId - Form identifier.
   * @return {Promise<FormTeam[]>} Linked teams.
   * @throws {ApiNotFoundError} If the form does not exist.
   * @memberof FormService
   */
  async getFormTeams(formId: number): Promise<FormTeam[]> {
    await this.getForm(formId);

    return this.formTeamRepository.getFormTeams(formId);
  }

  /**
   * Replace the teams linked to a form. Replacing with the same teams leaves the links unchanged; an empty list
   * removes every link of that form.
   *
   * @param {number} formId - Form identifier.
   * @param {string[]} teamIds - Teams to link.
   * @return {Promise<FormTeam[]>} Linked teams.
   * @throws {ApiNotFoundError} If the form does not exist.
   * @memberof FormService
   */
  async updateFormTeams(formId: number, teamIds: string[]): Promise<FormTeam[]> {
    await this.getForm(formId);

    const uniqueTeamIds = [...new Set(teamIds)];

    await this.formTeamRepository.deleteFormTeamsNotIn(formId, uniqueTeamIds);
    await this.formTeamRepository.insertFormTeams(formId, uniqueTeamIds);

    return this.formTeamRepository.getFormTeams(formId);
  }

  /**
   * Get a form or throw.
   *
   * @param {number} formId - Form identifier.
   * @return {Promise<Form>} The form.
   * @throws {ApiNotFoundError} If the form does not exist.
   * @memberof FormService
   */
  private async getForm(formId: number): Promise<Form> {
    const form = await this.formRepository.getForm(formId);

    if (!form) {
      throw new ApiNotFoundError('Form not found');
    }

    return form;
  }

  /**
   * Get a form version within its form or throw.
   *
   * @param {number} formId - Owning form.
   * @param {number} formVersionId - Form version identifier.
   * @return {Promise<FormVersion>} The form version.
   * @throws {ApiNotFoundError} If the version does not exist within the form.
   * @memberof FormService
   */
  private async getFormVersion(formId: number, formVersionId: number): Promise<FormVersion> {
    const formVersion = await this.formVersionRepository.getFormVersion(formId, formVersionId);

    if (!formVersion) {
      throw new ApiNotFoundError('Form version not found');
    }

    return formVersion;
  }

  /**
   * Require an active draft form version.
   *
   * @param {FormVersion} formVersion - Form version being changed.
   * @return {void}
   * @throws {ApiConflictError} If the version is published or retired.
   * @memberof FormService
   */
  private assertFormVersionIsDraft(formVersion: FormVersion): void {
    if (formVersion.record_effective_date !== null || formVersion.record_end_date !== null) {
      throw new ApiConflictError('Only draft form versions can be edited');
    }
  }

  /**
   * Validate a layout: no repeated feature type, no repeated property within a section, only feature types and
   * properties that are not retired, only property types a form can collect, and a codeset of the form's contributor
   * on every code-valued field and on no other field.
   *
   * @param {SaveFormSection[]} sections - Layout to validate.
   * @param {number} contributorId - Contributor that owns the form.
   * @return {Promise<void>}
   * @throws {ApiValidationError} If the layout is invalid.
   * @memberof FormService
   */
  private async validateFormSections(sections: SaveFormSection[], contributorId: number): Promise<void> {
    const featureTypeIds = sections.map((section) => section.featureTypeId);

    if (new Set(featureTypeIds).size !== featureTypeIds.length) {
      throw new ApiValidationError('A feature type can be added to a form only once');
    }

    const hasRepeatedField = sections.some((section) => {
      const featurePropertyIds = section.fields.map((field) => field.featurePropertyId);
      return new Set(featurePropertyIds).size !== featurePropertyIds.length;
    });

    if (hasRepeatedField) {
      throw new ApiValidationError('A property can be added to a section only once');
    }

    const fields = sections.flatMap((section) => section.fields);
    const featurePropertyIds = [...new Set(fields.map((field) => field.featurePropertyId))];
    const activeFeatureTypeIds = await this.featureTypeService.getActiveFeatureTypeIds(featureTypeIds);
    const activeFeatureProperties = await this.featurePropertyService.getActiveFeaturePropertyTypes(featurePropertyIds);
    const typeNameByFeaturePropertyId = new Map(
      activeFeatureProperties.map((featureProperty) => [featureProperty.feature_property_id, featureProperty.type_name])
    );
    const missingFeatureTypeIds = featureTypeIds.filter((id) => !activeFeatureTypeIds.includes(id));
    const missingFeaturePropertyIds = featurePropertyIds.filter((id) => !typeNameByFeaturePropertyId.has(id));

    if (missingFeatureTypeIds.length || missingFeaturePropertyIds.length) {
      throw new ApiValidationError('The layout references retired or missing definitions', [
        { feature_type_ids: missingFeatureTypeIds, feature_property_ids: missingFeaturePropertyIds }
      ]);
    }

    const unsupportedFeaturePropertyIds = featurePropertyIds.filter(
      (id) => !FORM_SUPPORTED_PROPERTY_TYPES.includes(String(typeNameByFeaturePropertyId.get(id)))
    );

    if (unsupportedFeaturePropertyIds.length) {
      throw new ApiValidationError('A form cannot collect properties of these types', [
        { feature_property_ids: unsupportedFeaturePropertyIds }
      ]);
    }

    const codesets = await this.contributorCodesetService.getContributorCodesetsByContributorId(contributorId);
    const contributorCodesetIds = new Set(codesets.map((codeset) => codeset.contributor_codeset_id));
    const hasInvalidCodeset = fields.some((field) => {
      const isCodeField = typeNameByFeaturePropertyId.get(field.featurePropertyId) === FEATURE_PROPERTY_TYPE.CODE;

      if (!isCodeField) {
        return field.contributorCodesetId !== null;
      }

      return field.contributorCodesetId === null || !contributorCodesetIds.has(field.contributorCodesetId);
    });

    if (hasInvalidCodeset) {
      throw new ApiValidationError(
        "Every code field needs a codeset of the form's contributor, and no other field may name a codeset"
      );
    }
  }

  /**
   * Write a draft version's Blueprint composition from its layout, then replace the version's presentation.
   *
   * Memberships still in the layout keep their identifiers; removed ones are ended, never deleted. The caller must
   * hold the blueprint administration lock and have validated that the Blueprint is editable.
   *
   * @param {FormVersion} formVersion - Draft version being saved.
   * @param {SaveFormSection[]} sections - Validated layout.
   * @param {string} date - Database lifecycle date for ended memberships.
   * @return {Promise<void>}
   * @memberof FormService
   */
  private async saveFormVersionLayout(
    formVersion: FormVersion,
    sections: SaveFormSection[],
    date: string
  ): Promise<void> {
    const blueprintId = formVersion.blueprint_id;
    const formVersionId = formVersion.form_version_id;

    const featureTypes: EnsureBlueprintFeatureType[] = sections.map((section, index) => ({
      featureTypeId: section.featureTypeId,
      sort: index
    }));
    const featureTypeKeys = await this.blueprintFeatureTypeService.ensureBlueprintFeatureTypes(
      blueprintId,
      featureTypes
    );
    const blueprintFeatureTypeIdByFeatureTypeId = new Map(
      featureTypeKeys.map((key) => [key.feature_type_id, key.blueprint_feature_type_id])
    );

    const properties: EnsureBlueprintFeatureTypeProperty[] = sections.flatMap((section) =>
      section.fields.map((field, index) => ({
        blueprintFeatureTypeId: Number(blueprintFeatureTypeIdByFeatureTypeId.get(section.featureTypeId)),
        featurePropertyId: field.featurePropertyId,
        sort: index
      }))
    );
    const retainedPairs: BlueprintFeatureTypePropertyPair[] = properties.map((property) => ({
      blueprintFeatureTypeId: property.blueprintFeatureTypeId,
      featurePropertyId: property.featurePropertyId
    }));
    const retainedFeatureTypeIds = sections.map((section) => section.featureTypeId);

    // Children first: end the property memberships of removed feature types before the feature types themselves.
    await this.blueprintFeatureTypePropertyService.deleteBlueprintFeatureTypePropertiesNotIn(
      blueprintId,
      retainedPairs,
      date
    );
    await this.blueprintFeatureTypeService.deleteBlueprintFeatureTypesNotIn(blueprintId, retainedFeatureTypeIds, date);

    const propertyKeys = await this.blueprintFeatureTypePropertyService.ensureBlueprintFeatureTypeProperties(
      properties
    );
    const blueprintFeatureTypePropertyIdByPair = new Map(
      propertyKeys.map((key) => [
        `${key.blueprint_feature_type_id}:${key.feature_property_id}`,
        key.blueprint_feature_type_property_id
      ])
    );

    const formSections: InsertFormSection[] = sections.map((section) => ({
      formVersionId,
      blueprintFeatureTypeId: Number(blueprintFeatureTypeIdByFeatureTypeId.get(section.featureTypeId)),
      label: section.label,
      description: section.description,
      requiredValue: section.requiredValue,
      allowMultiple: section.allowMultiple
    }));
    const formFields: InsertFormField[] = sections.flatMap((section) => {
      const blueprintFeatureTypeId = blueprintFeatureTypeIdByFeatureTypeId.get(section.featureTypeId);

      return section.fields.map((field) => ({
        formVersionId,
        blueprintFeatureTypePropertyId: Number(
          blueprintFeatureTypePropertyIdByPair.get(`${blueprintFeatureTypeId}:${field.featurePropertyId}`)
        ),
        label: field.label,
        description: field.description,
        contributorCodesetId: field.contributorCodesetId
      }));
    });

    await this.formVersionFeatureTypePropertyRepository.deleteFormFields(formVersionId);
    await this.formVersionFeatureTypeRepository.deleteFormSections(formVersionId);
    await this.formVersionFeatureTypeRepository.insertFormSections(formSections);
    await this.formVersionFeatureTypePropertyRepository.insertFormFields(formFields);
  }
}
