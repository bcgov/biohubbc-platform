import Ajv from 'ajv';
import { expect } from 'chai';
import { describe } from 'mocha';
import { OpenAPIV3 } from 'openapi-types';
import {
  codePropertyValueSchema,
  submissionFeaturePropertyValueSchema,
  taxonPropertyValueSchema
} from './submission-feature-property-value';

describe('submissionFeaturePropertyValueSchema', () => {
  const ajv = new Ajv();
  const validate = ajv.compile(submissionFeaturePropertyValueSchema);

  it('accepts a scalar string value', () => {
    expect(validate('Wolf')).to.be.true;
  });

  it('accepts a taxon value, with and without a rank', () => {
    expect(validate({ taxon_id: 1, tsn: 180596, rank: 'Species', label: 'Canis lupus' })).to.be.true;
    expect(validate({ taxon_id: 1, tsn: 180596, rank: null, label: 'Canis lupus' })).to.be.true;
  });

  it('accepts a code value', () => {
    expect(
      validate({ codeset_key: 'sign', codeset_label: 'Sign', code_key: 'track', code_label: 'Track', label: 'Track' })
    ).to.be.true;
  });

  it('rejects objects that are not a known reference value', () => {
    expect(validate({ label: 'Canis lupus' })).to.be.false;
    expect(validate({ taxon_id: 1, tsn: 180596, rank: 'Species', label: 'Canis lupus', extra: true })).to.be.false;
    expect(validate({ type: 'Point', coordinates: [1, 2] })).to.be.false;
    expect(validate({ codeset_key: 'sign', code_key: 'track', label: 'Track' })).to.be.false;
  });

  it('keeps the reference value schemas disjoint', () => {
    const objectMembers = (submissionFeaturePropertyValueSchema.oneOf ?? []).filter(
      (member): member is OpenAPIV3.SchemaObject => (member as OpenAPIV3.SchemaObject).type === 'object'
    );

    expect(objectMembers).to.have.lengthOf(2);
    for (const member of objectMembers) {
      expect(member.additionalProperties).to.be.false;
      expect(member.required).to.have.members(Object.keys(member.properties ?? {}));
    }
  });
});

describe('taxonPropertyValueSchema', () => {
  const properties = taxonPropertyValueSchema.properties as Record<string, OpenAPIV3.SchemaObject>;

  it('requires every key and allows a null rank', () => {
    expect(taxonPropertyValueSchema.required).to.have.members(['taxon_id', 'tsn', 'rank', 'label']);
    expect(properties.taxon_id).to.include({ type: 'integer' });
    expect(properties.tsn).to.include({ type: 'integer' });
    expect(properties.rank).to.include({ type: 'string', nullable: true });
    expect(properties.label).to.include({ type: 'string' });
  });
});

describe('codePropertyValueSchema', () => {
  it('requires every key', () => {
    expect(codePropertyValueSchema.required).to.have.members([
      'codeset_key',
      'codeset_label',
      'code_key',
      'code_label',
      'label'
    ]);
    expect(codePropertyValueSchema.additionalProperties).to.be.false;
  });
});
