import { IFormSection } from 'interfaces/useFormsApi.interface';
import { createFormSubmissionRow, toCodeValue, toFormSubmissionData, toFormSubmissionRows } from './formSubmissionRows';

const makeSection = (featureTypeId: number, requiredValue: boolean): IFormSection => ({
  blueprint_feature_type_id: featureTypeId * 10,
  feature_type_id: featureTypeId,
  feature_type_name: `type-${featureTypeId}`,
  feature_type_display_name: `Type ${featureTypeId}`,
  label: `Type ${featureTypeId}`,
  description: null,
  required_value: requiredValue,
  allow_multiple: true,
  sort: 0,
  fields: []
});

describe('formSubmissionRows', () => {
  it('gives each new row its own source identifier', () => {
    expect(createFormSubmissionRow().sourceId).not.toEqual(createFormSubmissionRow().sourceId);
  });

  it('starts a required section with one row and an optional section with none', () => {
    const rows = toFormSubmissionRows([makeSection(1, true), makeSection(2, false)], null);

    expect(rows[1]).toHaveLength(1);
    expect(rows[2]).toEqual([]);
  });

  it('restores the rows of a saved draft, keeping their source identifiers', () => {
    const savedRow = { sourceId: 'row-1', values: { '200': 'female' } };
    const rows = toFormSubmissionRows([makeSection(1, true), makeSection(2, false)], {
      sections: [{ featureTypeId: 1, rows: [savedRow] }]
    });

    expect(rows[1]).toEqual([savedRow]);
    expect(rows[2]).toEqual([]);
  });

  it('builds the draft document in section order', () => {
    const row = { sourceId: 'row-1', values: {} };

    expect(toFormSubmissionData([makeSection(2, false), makeSection(1, false)], { 1: [row] })).toEqual({
      sections: [
        { featureTypeId: 2, rows: [] },
        { featureTypeId: 1, rows: [row] }
      ]
    });
  });

  it('stores a code as ingestion resolves it', () => {
    expect(toCodeValue('sex', 'female')).toEqual('code::sex::female');
  });
});
