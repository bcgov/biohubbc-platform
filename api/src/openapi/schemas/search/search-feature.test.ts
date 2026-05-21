import { expect } from 'chai';
import { describe } from 'mocha';
import { featureSearchRequestBodySchema, featureSearchResultSchema } from './search-feature';

describe('featureSearchRequestBodySchema', () => {
  const schema = featureSearchRequestBodySchema.content['application/json'].schema;

  it('accepts a pagination-only feature search body', () => {
    expect(schema).to.include({
      type: 'object',
      additionalProperties: false
    });
    expect(schema).to.not.have.property('required');
    expect(schema.properties).to.have.property('pagination');
  });

  it('accepts an expression tree feature search body', () => {
    expect(schema.properties).to.have.property('expression');
    expect(schema.properties.expression.properties).to.include.keys(['type', 'operator', 'clauses']);
    expect(schema.properties).to.not.include.keys(['type', 'operator', 'clauses']);
    const predicateSchema = schema.properties.expression.properties.clauses.items.oneOf[0];
    expect(predicateSchema.required).to.include.members(['feature_property_id', 'feature_type_property_id']);
    expect(predicateSchema.properties.feature_type_property_id).to.include({ nullable: true });
  });

  it('rejects the old filters wrapper body', () => {
    expect(schema).to.have.property('additionalProperties', false);
    expect(schema.properties).to.not.have.property('filters');
  });

  it('documents every returned feature result field', () => {
    expect(featureSearchResultSchema.required).to.include('create_date');
    expect(featureSearchResultSchema.properties).to.have.property('create_date');
  });
});
