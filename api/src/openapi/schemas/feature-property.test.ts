import { expect } from 'chai';
import { describe } from 'mocha';
import { CreateFeaturePropertyRequestSchema, UpdateFeaturePropertyRequestSchema } from './feature-property';

describe('feature property request schemas', () => {
  it('requires feature_property_type_id when creating a property', () => {
    expect(CreateFeaturePropertyRequestSchema.required).to.include('feature_property_type_id');
    expect(CreateFeaturePropertyRequestSchema.properties).to.have.property('feature_property_type_id');
  });

  it('rejects feature_property_type_id and other unknown fields when updating a property', () => {
    expect(UpdateFeaturePropertyRequestSchema.additionalProperties).to.equal(false);
    expect(UpdateFeaturePropertyRequestSchema.properties).not.to.have.property('feature_property_type_id');
  });
});
