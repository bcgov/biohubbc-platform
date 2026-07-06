import { expect } from 'chai';
import { describe, it } from 'mocha';
import { IFlattenedBlock } from '../models/submission-feature';
import { computeSubmissionFeatureContentHash } from './feature-content-hash';

describe('computeSubmissionFeatureContentHash', () => {
  const baseFeature: IFlattenedBlock = {
    id: 'feature-1',
    type: 'observation',
    properties: { name: 'Moose sighting', count: 4 },
    content: ['artifact-1', 'artifact-2'],
    parent: 'survey-1'
  };

  it('returns a 64 character SHA-256 hex digest', () => {
    const hash = computeSubmissionFeatureContentHash(baseFeature);

    expect(hash).to.match(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    expect(computeSubmissionFeatureContentHash(baseFeature)).to.equal(computeSubmissionFeatureContentHash(baseFeature));
  });

  it('excludes the feature id (source id) from the hash', () => {
    const renamed: IFlattenedBlock = { ...baseFeature, id: 'feature-2' };

    expect(computeSubmissionFeatureContentHash(renamed)).to.equal(computeSubmissionFeatureContentHash(baseFeature));
  });

  it('is independent of property key ordering', () => {
    const reordered: IFlattenedBlock = {
      ...baseFeature,
      properties: { count: 4, name: 'Moose sighting' }
    };

    expect(computeSubmissionFeatureContentHash(reordered)).to.equal(computeSubmissionFeatureContentHash(baseFeature));
  });

  it('is independent of nested object key ordering', () => {
    const featureA: IFlattenedBlock = {
      ...baseFeature,
      properties: { geometry: { type: 'Point', coordinates: [-123.5, 48.4] } }
    };
    const featureB: IFlattenedBlock = {
      ...baseFeature,
      properties: { geometry: { coordinates: [-123.5, 48.4], type: 'Point' } }
    };

    expect(computeSubmissionFeatureContentHash(featureA)).to.equal(computeSubmissionFeatureContentHash(featureB));
  });

  it('is independent of content reference ordering', () => {
    const reordered: IFlattenedBlock = { ...baseFeature, content: ['artifact-2', 'artifact-1'] };

    expect(computeSubmissionFeatureContentHash(reordered)).to.equal(computeSubmissionFeatureContentHash(baseFeature));
  });

  it('is independent of top-level property array ordering', () => {
    const featureA: IFlattenedBlock = {
      ...baseFeature,
      properties: { observers: ['alice', 'bob'], samples: [{ id: 1 }, { id: 2 }] }
    };
    const featureB: IFlattenedBlock = {
      ...baseFeature,
      properties: { observers: ['bob', 'alice'], samples: [{ id: 2 }, { id: 1 }] }
    };

    expect(computeSubmissionFeatureContentHash(featureA)).to.equal(computeSubmissionFeatureContentHash(featureB));
  });

  it('is sensitive to nested array ordering (order-semantic values such as coordinates)', () => {
    const featureA: IFlattenedBlock = {
      ...baseFeature,
      properties: {
        geometry: {
          type: 'LineString',
          coordinates: [
            [-123.5, 48.4],
            [-123.6, 48.5]
          ]
        }
      }
    };
    const featureB: IFlattenedBlock = {
      ...baseFeature,
      properties: {
        geometry: {
          type: 'LineString',
          coordinates: [
            [-123.6, 48.5],
            [-123.5, 48.4]
          ]
        }
      }
    };

    expect(computeSubmissionFeatureContentHash(featureA)).to.not.equal(computeSubmissionFeatureContentHash(featureB));
  });

  it('treats an absent parent and a null parent as equivalent', () => {
    const nullParent: IFlattenedBlock = { ...baseFeature, parent: null };
    const absentParent = { ...baseFeature } as IFlattenedBlock;
    delete (absentParent as Partial<IFlattenedBlock>).parent;

    expect(computeSubmissionFeatureContentHash(absentParent)).to.equal(computeSubmissionFeatureContentHash(nullParent));
  });

  it('changes when a property value changes', () => {
    const changed: IFlattenedBlock = {
      ...baseFeature,
      properties: { ...baseFeature.properties, count: 5 }
    };

    expect(computeSubmissionFeatureContentHash(changed)).to.not.equal(computeSubmissionFeatureContentHash(baseFeature));
  });

  it('changes when the parent changes', () => {
    const changed: IFlattenedBlock = { ...baseFeature, parent: 'survey-2' };

    expect(computeSubmissionFeatureContentHash(changed)).to.not.equal(computeSubmissionFeatureContentHash(baseFeature));
  });

  it('changes when the feature type changes', () => {
    const changed: IFlattenedBlock = { ...baseFeature, type: 'incidental_observation' };

    expect(computeSubmissionFeatureContentHash(changed)).to.not.equal(computeSubmissionFeatureContentHash(baseFeature));
  });

  it('changes when a content reference is added', () => {
    const changed: IFlattenedBlock = { ...baseFeature, content: [...baseFeature.content, 'artifact-3'] };

    expect(computeSubmissionFeatureContentHash(changed)).to.not.equal(computeSubmissionFeatureContentHash(baseFeature));
  });

  it('drops undefined property values, matching JSON.stringify semantics', () => {
    const withUndefined: IFlattenedBlock = {
      ...baseFeature,
      properties: { ...baseFeature.properties, comment: undefined }
    };

    expect(computeSubmissionFeatureContentHash(withUndefined)).to.equal(
      computeSubmissionFeatureContentHash(baseFeature)
    );
  });

  it('distinguishes null property values from absent properties', () => {
    const withNull: IFlattenedBlock = {
      ...baseFeature,
      properties: { ...baseFeature.properties, comment: null }
    };

    expect(computeSubmissionFeatureContentHash(withNull)).to.not.equal(
      computeSubmissionFeatureContentHash(baseFeature)
    );
  });
});
