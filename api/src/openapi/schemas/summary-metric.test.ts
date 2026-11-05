import Ajv from 'ajv';
import { expect } from 'chai';
import {
  CreateSummaryMetricDataRequestSchema,
  CreateSummaryMetricRequestSchema,
  UpdateSummaryMetricDataRequestSchema,
  UpdateSummaryMetricRequestSchema
} from './summary-metric';

describe('summary metric API request schemas', () => {
  const ajv = new Ajv({ strict: false, validateFormats: false });

  it('requires a key on creation and prevents changing keys or lifecycle fields through PUT', () => {
    const create = ajv.compile(CreateSummaryMetricRequestSchema);
    const update = ajv.compile(UpdateSummaryMetricRequestSchema);
    expect(create({ key: 'record_count', name: 'Records', description: '' })).to.equal(true);
    expect(create({ name: 'Records', description: '' })).to.equal(false);
    expect(create({ key: 'bad key', name: 'Records', description: '' })).to.equal(false);
    expect(update({ name: 'Records', description: '' })).to.equal(true);
    expect(update({ name: 'Records', description: '', key: 'different_key' })).to.equal(false);
    expect(update({ name: 'Records', description: '', record_end_date: null })).to.equal(false);
  });

  for (const value of [123, '2026-11-04', null, false, { count: 1 }, [1, 'two']]) {
    it(`accepts a JSON ${JSON.stringify(value)} value without coercing its type`, () => {
      const create = ajv.compile(CreateSummaryMetricDataRequestSchema);
      const update = ajv.compile(UpdateSummaryMetricDataRequestSchema);
      expect(
        create({
          summary_metric_id: 1,
          run_id: '11111111-1111-4111-8111-111111111111',
          calculated_at: '2026-11-04T00:00:00Z',
          value
        })
      ).to.equal(true);
      expect(update({ value })).to.equal(true);
    });
  }

  it('requires a value, including explicit null, and prevents changing snapshot identity on PUT', () => {
    const update = ajv.compile(UpdateSummaryMetricDataRequestSchema);
    expect(update({})).to.equal(false);
    expect(update({ value: 1, summary_metric_id: 2 })).to.equal(false);
    expect(update({ value: 1, run_id: '11111111-1111-4111-8111-111111111111' })).to.equal(false);
    expect(update({ value: 1, calculated_at: '2026-11-04T00:00:00Z' })).to.equal(false);
  });
});
