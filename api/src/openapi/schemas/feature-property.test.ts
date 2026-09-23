import { expect } from 'chai';
import { describe } from 'mocha';
import { CreateFeaturePropertyRequestSchema, UpdateFeaturePropertyRequestSchema } from './feature-property';
import { UpdateFeatureTypeRequestSchema } from './feature-type';

describe('feature property request schemas', () => {
  it('only accepts feature type display name and description updates', () => {
    expect(UpdateFeatureTypeRequestSchema.additionalProperties).to.equal(false);
    expect(Object.keys(UpdateFeatureTypeRequestSchema.properties!)).to.have.members(['display_name', 'description']);
  });
  it('requires feature_property_type_id when creating a property', () => {
    expect(CreateFeaturePropertyRequestSchema.required).to.include('feature_property_type_id');
    expect(CreateFeaturePropertyRequestSchema.properties).to.have.property('feature_property_type_id');
  });

  it('rejects feature_property_type_id and other unknown fields when updating a property', () => {
    expect(UpdateFeaturePropertyRequestSchema.additionalProperties).to.equal(false);
    expect(Object.keys(UpdateFeaturePropertyRequestSchema.properties!)).to.have.members([
      'display_name',
      'description'
    ]);
  });
});
