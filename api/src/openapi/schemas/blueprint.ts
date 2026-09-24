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

/**
 * Schema for a property assigned to a blueprint feature type (admin view).
 */
export const AdminBlueprintFeatureTypePropertySchema: OpenAPIV3.SchemaObject = {
  title: 'AdminBlueprintFeatureTypeProperty',
  type: 'object',
  required: [
    'blueprint_feature_type_property_id',
    'blueprint_feature_type_id',
    'feature_property_id',
    'property_name',
    'property_display_name',
    'property_type_name',
    'required_value',
    'allow_multiple',
    'sort'
  ],
  properties: {
    blueprint_feature_type_property_id: {
      type: 'integer',
      minimum: 1,
      description: 'System generated surrogate primary key identifier of the assignment'
    },
    blueprint_feature_type_id: {
      type: 'integer',
      minimum: 1,
      description: 'Foreign key to the blueprint_feature_type table'
    },
    feature_property_id: {
      type: 'integer',
      minimum: 1,
      description: 'Foreign key to the feature_property table; the reusable property definition being assigned'
    },
    property_name: {
      type: 'string',
      description: 'Name of the feature property'
    },
    property_display_name: {
      type: 'string',
      description: 'Display name of the feature property'
    },
    property_type_name: {
      type: 'string',
      description: 'Name of the feature property type'
    },
    required_value: {
      type: 'boolean',
      description: 'Whether the property is required for the feature type within this blueprint'
    },
    allow_multiple: {
      type: 'boolean',
      description: 'Whether the property may carry multiple values for the feature type within this blueprint'
    },
    sort: {
      type: 'integer',
      nullable: true,
      description: 'Custom sort order of the property within the feature type'
    }
  }
};

/**
 * Schema for paginated blueprint feature type properties list response.
 */
export const BlueprintFeatureTypePropertiesListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'BlueprintFeatureTypePropertiesListResponse',
  type: 'object',
  required: ['blueprint_feature_type_properties', 'pagination'],
  properties: {
    blueprint_feature_type_properties: {
      type: 'array',
      items: AdminBlueprintFeatureTypePropertySchema,
      description: 'List of properties assigned to the blueprint feature type'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for create blueprint feature type property request body.
 * The blueprint feature type is taken from the path param, not the body.
 */
export const CreateBlueprintFeatureTypePropertyRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateBlueprintFeatureTypePropertyRequest',
  type: 'object',
  required: ['feature_property_id'],
  properties: {
    feature_property_id: {
      type: 'integer',
      minimum: 1,
      description: 'Foreign key to the feature_property table; the property to assign'
    },
    required_value: {
      type: 'boolean',
      description: 'Whether the property is required for the feature type within this blueprint'
    },
    allow_multiple: {
      type: 'boolean',
      description: 'Whether the property may carry multiple values for the feature type within this blueprint'
    },
    sort: {
      type: 'integer',
      nullable: true,
      description: 'Custom sort order of the property within the feature type'
    }
  }
};

/**
 * Schema for update blueprint feature type property request body.
 * Only assignment metadata is updatable; the assigned property cannot change.
 */
export const UpdateBlueprintFeatureTypePropertyRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'UpdateBlueprintFeatureTypePropertyRequest',
  type: 'object',
  minProperties: 1,
  properties: {
    required_value: {
      type: 'boolean',
      description: 'Whether the property is required for the feature type within this blueprint'
    },
    allow_multiple: {
      type: 'boolean',
      description: 'Whether the property may carry multiple values for the feature type within this blueprint'
    },
    sort: {
      type: 'integer',
      nullable: true,
      description: 'Custom sort order of the property within the feature type'
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
