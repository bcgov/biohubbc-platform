import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/**
 * Schema for a form slug: short, stable, URL-safe and kebab-case.
 */
export const FormSlugSchema: OpenAPIV3.SchemaObject = {
  type: 'string',
  minLength: 1,
  maxLength: 100,
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  description: 'The short, stable, URL-safe key of the form. Kebab-case; unique among active forms.'
};

/**
 * Schema for a form in the administrative list, with its latest active version.
 */
export const FormListItemSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'form_id',
    'slug',
    'name',
    'description',
    'is_public',
    'create_date',
    'form_version_id',
    'version_number',
    'record_effective_date'
  ],
  properties: {
    form_id: { type: 'integer', minimum: 1 },
    slug: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    is_public: { type: 'boolean' },
    create_date: { type: 'string' },
    form_version_id: { type: 'integer', minimum: 1, nullable: true },
    version_number: { type: 'integer', minimum: 1, nullable: true },
    record_effective_date: {
      type: 'string',
      nullable: true,
      description: 'The date the latest version was published; null while it is a draft'
    }
  }
};

/**
 * Schema for the paginated administrative form list response.
 */
export const FormsResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['forms', 'pagination'],
  properties: { forms: { type: 'array', items: FormListItemSchema }, pagination: paginationResponseSchema }
};

const SaveFormFieldSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['featurePropertyId', 'label', 'description', 'contributorCodesetId'],
  properties: {
    featurePropertyId: { type: 'integer', minimum: 1 },
    label: { type: 'string', minLength: 1, pattern: String.raw`\S` },
    description: { type: 'string', nullable: true },
    contributorCodesetId: {
      type: 'integer',
      minimum: 1,
      nullable: true,
      description: "For a code field, the codeset of the form's contributor whose codes it accepts; null otherwise"
    }
  }
};

const SaveFormSectionSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['featureTypeId', 'label', 'description', 'requiredValue', 'allowMultiple', 'fields'],
  properties: {
    featureTypeId: { type: 'integer', minimum: 1 },
    label: { type: 'string', minLength: 1, pattern: String.raw`\S` },
    description: { type: 'string', nullable: true },
    requiredValue: { type: 'boolean', description: 'Whether the section requires at least one row' },
    allowMultiple: { type: 'boolean', description: 'Whether the section accepts more than one row' },
    fields: { type: 'array', items: SaveFormFieldSchema, description: 'Fields in display order' }
  }
};

const saveFormVersionProperties: Record<string, OpenAPIV3.SchemaObject> = {
  name: { type: 'string', minLength: 1, pattern: String.raw`\S` },
  description: { type: 'string', nullable: true },
  isPublic: { type: 'boolean', description: 'Whether anyone may access the form, rather than members of its teams' },
  sections: { type: 'array', items: SaveFormSectionSchema, description: 'Sections in display order' }
};

/**
 * Schema for the form metadata and complete layout of a draft version, as saved by the form builder.
 */
export const SaveFormVersionRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'isPublic', 'sections'],
  properties: saveFormVersionProperties
};

/**
 * Schema for a new form and the layout of its first version. The slug and contributor cannot change afterwards.
 */
export const CreateFormRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'contributorId', 'name', 'description', 'isPublic', 'sections'],
  properties: {
    slug: FormSlugSchema,
    contributorId: {
      type: 'integer',
      minimum: 1,
      description: "The contributor that owns the form's submissions and whose codesets its code fields draw from"
    },
    ...saveFormVersionProperties
  }
};

const FormFieldSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'blueprint_feature_type_property_id',
    'blueprint_feature_type_id',
    'feature_property_id',
    'feature_property_name',
    'feature_property_display_name',
    'type_name',
    'label',
    'description',
    'contributor_codeset_id',
    'sort'
  ],
  properties: {
    blueprint_feature_type_property_id: { type: 'integer' },
    blueprint_feature_type_id: { type: 'integer' },
    feature_property_id: { type: 'integer' },
    feature_property_name: { type: 'string' },
    feature_property_display_name: { type: 'string' },
    type_name: { type: 'string' },
    label: { type: 'string' },
    description: { type: 'string', nullable: true },
    contributor_codeset_id: { type: 'integer', nullable: true },
    sort: { type: 'integer', nullable: true }
  }
};

const FormSectionSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'blueprint_feature_type_id',
    'feature_type_id',
    'feature_type_name',
    'feature_type_display_name',
    'label',
    'description',
    'required_value',
    'allow_multiple',
    'sort',
    'fields'
  ],
  properties: {
    blueprint_feature_type_id: { type: 'integer' },
    feature_type_id: { type: 'integer' },
    feature_type_name: { type: 'string' },
    feature_type_display_name: { type: 'string' },
    label: { type: 'string' },
    description: { type: 'string', nullable: true },
    required_value: { type: 'boolean' },
    allow_multiple: { type: 'boolean' },
    sort: { type: 'integer', nullable: true },
    fields: { type: 'array', items: FormFieldSchema }
  }
};

/**
 * Schema for a form version and its complete layout.
 */
export const FormVersionLayoutSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['form', 'form_version', 'sections'],
  properties: {
    form: {
      type: 'object',
      required: ['form_id', 'slug', 'contributor_id', 'team_id', 'name', 'description', 'is_public', 'record_end_date'],
      properties: {
        form_id: { type: 'integer' },
        slug: { type: 'string' },
        contributor_id: { type: 'integer' },
        team_id: { type: 'string', format: 'uuid', description: 'The form administration team' },
        name: { type: 'string' },
        description: { type: 'string', nullable: true },
        is_public: { type: 'boolean' },
        record_end_date: { type: 'string', nullable: true }
      }
    },
    form_version: {
      type: 'object',
      required: [
        'form_version_id',
        'form_id',
        'blueprint_id',
        'version_number',
        'record_effective_date',
        'record_end_date'
      ],
      properties: {
        form_version_id: { type: 'integer' },
        form_id: { type: 'integer' },
        blueprint_id: { type: 'integer' },
        version_number: { type: 'integer' },
        record_effective_date: { type: 'string', nullable: true },
        record_end_date: { type: 'string', nullable: true }
      }
    },
    sections: { type: 'array', items: FormSectionSchema }
  }
};

/**
 * Schema for the teams linked to a form.
 */
export const FormTeamsResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['teams'],
  properties: {
    teams: {
      type: 'array',
      items: {
        type: 'object',
        required: ['team_id', 'name'],
        properties: { team_id: { type: 'string', format: 'uuid' }, name: { type: 'string' } }
      }
    }
  }
};

/**
 * Schema for replacing the teams linked to a form.
 */
export const UpdateFormTeamsRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['teamIds'],
  properties: {
    teamIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
      description: 'Every team whose members may access the form when it is not public'
    }
  }
};
