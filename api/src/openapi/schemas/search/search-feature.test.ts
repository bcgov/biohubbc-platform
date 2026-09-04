import { expect } from 'chai';
import { describe } from 'mocha';
import { OpenAPIV3 } from 'openapi-types';
import {
  featureSearchCountRequestBodySchema,
  featureSearchCountResponseSchema,
  featureSearchPropertySchema,
  featureSearchRequestBodySchema,
  featureSearchResponseSchema,
  featureSearchResultSchema
} from './search-feature';

describe('featureSearchRequestBodySchema', () => {
  const schema = featureSearchRequestBodySchema.content['application/json'].schema as OpenAPIV3.SchemaObject;
  const schemaProperties = schema.properties as Record<string, OpenAPIV3.SchemaObject>;

  it('accepts a pagination-only feature search body', () => {
    expect(schema).to.include({
      type: 'object',
      additionalProperties: false
    });
    expect(schema).to.not.have.property('required');
    expect(schemaProperties).to.have.property('pagination');
    const paginationSchema = schemaProperties.pagination;
    expect(paginationSchema.properties).to.include.keys(['limit', 'cursor', 'sort', 'order']);
    expect(paginationSchema.properties).to.not.have.property('page');
  });

  it('accepts an expression tree feature search body', () => {
    const expressionSchema = schemaProperties.expression;
    const expressionProperties = expressionSchema.properties as Record<string, OpenAPIV3.SchemaObject>;
    const clausesSchema = expressionProperties.clauses as OpenAPIV3.ArraySchemaObject;
    const predicateSchema = (clausesSchema.items as OpenAPIV3.SchemaObject).oneOf?.[0] as OpenAPIV3.SchemaObject;
    const predicateProperties = predicateSchema.properties as Record<string, OpenAPIV3.SchemaObject>;

    expect(schemaProperties).to.have.property('expression');
    expect(expressionProperties).to.include.keys(['type', 'operator', 'clauses']);
    expect(schemaProperties).to.not.include.keys(['type', 'operator', 'clauses']);
    expect(predicateSchema.required).to.include.members(['feature_property_id', 'feature_type_property_id']);
    expect(predicateProperties.feature_type_property_id).to.include({ nullable: true });
  });

  it('rejects the old filters wrapper body', () => {
    expect(schema).to.have.property('additionalProperties', false);
    expect(schemaProperties).to.not.have.property('filters');
  });

  it('documents every returned feature result field', () => {
    expect(featureSearchResultSchema.required).to.include.members(['create_date', 'properties']);
    expect(featureSearchResultSchema.properties).to.have.property('create_date');
    expect(featureSearchResultSchema.properties).to.have.property('properties');
  });

  it('documents response-level property metadata used for table columns', () => {
    const responseProperties = featureSearchResponseSchema.properties as Record<string, OpenAPIV3.SchemaObject>;

    expect(featureSearchResponseSchema.required).to.include.members([
      'features',
      'properties',
      'has_more_secured_features',
      'pagination'
    ]);
    expect(responseProperties.pagination).to.deep.include({ type: 'object', additionalProperties: false });
    expect(responseProperties.pagination.properties).to.include.keys([
      'limit',
      'sort',
      'order',
      'next_cursor',
      'previous_cursor'
    ]);
    expect(responseProperties.pagination.properties).to.not.include.keys([
      'total',
      'current_page',
      'last_page',
      'per_page'
    ]);
    expect(responseProperties.properties).to.deep.include({
      type: 'array',
      items: featureSearchPropertySchema
    });
    expect(featureSearchPropertySchema.required).to.include.members([
      'feature_type_property_id',
      'name',
      'display_name',
      'type_name',
      'allow_multiple'
    ]);
    expect(featureSearchPropertySchema.properties?.allow_multiple).to.deep.include({
      type: 'boolean',
      description: 'Whether this property can be returned as an array of values.'
    });
  });

  it('documents the count response', () => {
    expect(featureSearchCountResponseSchema.required).to.deep.equal(['total']);
    expect(featureSearchCountResponseSchema.properties?.total).to.deep.include({
      type: 'integer',
      minimum: 0
    });
  });

  it('documents count requests without pagination', () => {
    const schema = featureSearchCountRequestBodySchema.content['application/json']?.schema as OpenAPIV3.SchemaObject;

    expect(schema.additionalProperties).to.equal(false);
    expect(schema.properties).to.have.property('expression');
    expect(schema.properties).to.not.have.property('pagination');
  });
});
