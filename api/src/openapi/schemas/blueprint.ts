import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/**
 * Schema for a blueprint record (admin view).
 */
export const AdminBlueprintSchema: OpenAPIV3.SchemaObject = {
  title: 'AdminBlueprint',
  type: 'object',
  required: [
    'blueprint_id',
    'version_number',
    'name',
    'description',
    'is_default',
    'parent_blueprint_id',
    'record_effective_date',
    'record_end_date'
  ],
  properties: {
    blueprint_id: {
      type: 'integer',
      minimum: 1,
      description: 'System generated surrogate primary key identifier'
    },
    version_number: {
      type: 'integer',
      description: 'Version number of the blueprint'
    },
    name: {
      type: 'string',
      description: 'Name of the blueprint'
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Description of the blueprint'
    },
    is_default: {
      type: 'boolean',
      description: 'Whether the blueprint is the default for new submissions'
    },
    parent_blueprint_id: {
      type: 'integer',
      minimum: 1,
      nullable: true,
      description: 'The blueprint this version was created from'
    },
    record_effective_date: {
      type: 'string',
      nullable: true,
      description: 'The date the blueprint was published; null while the blueprint is a draft'
    },
    record_end_date: {
      type: 'string',
      nullable: true,
      description: 'The date the blueprint was retired; null when the record is active'
    }
  }
};

/**
 * Schema for paginated blueprints list response.
 */
export const BlueprintsListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'BlueprintsListResponse',
  type: 'object',
  required: ['blueprints', 'pagination'],
  properties: {
    blueprints: {
      type: 'array',
      items: AdminBlueprintSchema,
      description: 'List of blueprints'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for create blueprint version request body.
 * The source blueprint is taken from the path param, not the body.
 */
export const CreateBlueprintVersionRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateBlueprintVersionRequest',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      description: 'Name of the new version; defaults to the name of the source blueprint'
    },
    description: {
      type: 'string',
      description: 'Description of the new version; defaults to the description of the source blueprint'
    }
  }
};

/**
 * Schema for publish blueprint request body.
 */
export const PublishBlueprintRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'PublishBlueprintRequest',
  type: 'object',
  properties: {
    is_default: {
      type: 'boolean',
      description: 'Whether the published blueprint becomes the default for new submissions'
    }
  }
};

export const BlueprintSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'blueprint_id',
    'name',
    'version_number',
    'description',
    'is_default',
    'parent_blueprint_id',
    'record_effective_date',
    'record_end_date'
  ],
  properties: {
    blueprint_id: { type: 'integer', minimum: 1 },
    name: { type: 'string' },
    version_number: { type: 'integer', minimum: 1 },
    description: { type: 'string', nullable: true },
    is_default: { type: 'boolean' },
    parent_blueprint_id: { type: 'integer', nullable: true },
    record_effective_date: { type: 'string', format: 'date', nullable: true },
    record_end_date: { type: 'string', format: 'date', nullable: true }
  }
};
export const UpdateBlueprintRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, pattern: '\\S' },
    description: { type: 'string', nullable: true },
    parentBlueprintId: { type: 'integer', minimum: 1, nullable: true },
    recordEffectiveDate: { type: 'string', format: 'date', nullable: true }
  }
};
export const CreateBlueprintRequestSchema: OpenAPIV3.SchemaObject = {
  ...UpdateBlueprintRequestSchema,
  required: ['name']
};
export const BlueprintsResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['blueprints', 'pagination'],
  properties: { blueprints: { type: 'array', items: BlueprintSchema }, pagination: paginationResponseSchema }
};
