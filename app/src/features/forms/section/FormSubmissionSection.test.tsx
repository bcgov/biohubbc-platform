import { cleanup, fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { IFormSection } from 'interfaces/useFormsApi.interface';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { IFormSubmissionRow } from '../formSubmissionRows';
import { FormSubmissionSection } from './FormSubmissionSection';

vi.mock('hooks/useApi');

const makeSection = (overrides: Partial<IFormSection> = {}): IFormSection => ({
  blueprint_feature_type_id: 10,
  feature_type_id: 100,
  feature_type_name: 'observation',
  feature_type_display_name: 'Observation',
  label: 'Sighting',
  description: 'One row per animal',
  required_value: true,
  allow_multiple: true,
  sort: 0,
  fields: [
    {
      blueprint_feature_type_property_id: 20,
      blueprint_feature_type_id: 10,
      feature_property_id: 200,
      feature_property_name: 'count',
      feature_property_display_name: 'Count',
      type_name: 'number',
      label: 'Count',
      description: null,
      contributor_codeset_id: null,
      sort: 0
    },
    {
      blueprint_feature_type_property_id: 21,
      blueprint_feature_type_id: 10,
      feature_property_id: 201,
      feature_property_name: 'collared',
      feature_property_display_name: 'Collared',
      type_name: 'boolean',
      label: 'Collared',
      description: null,
      contributor_codeset_id: null,
      sort: 1
    }
  ],
  ...overrides
});

const renderSection = (section: IFormSection, rows: IFormSubmissionRow[], readOnly = false) => {
  const onRowsChange = vi.fn();
  const page = render(
    <FormSubmissionSection
      slug="caribou"
      section={section}
      codesetsById={new Map()}
      rows={rows}
      onRowsChange={onRowsChange}
      readOnly={readOnly}
    />
  );

  return { ...page, onRowsChange };
};

describe('FormSubmissionSection', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue({ forms: { getFormCodesetCodes: vi.fn() } });
  });

  afterEach(() => {
    cleanup();
  });

  it('types entered values by property type', () => {
    const row = { sourceId: 'row-1', values: {} };
    const { getByLabelText, onRowsChange } = renderSection(makeSection(), [row]);

    fireEvent.change(getByLabelText('Count'), { target: { value: '4' } });
    expect(onRowsChange).toHaveBeenLastCalledWith([{ sourceId: 'row-1', values: { 200: 4 } }]);

    fireEvent.click(getByLabelText('Collared'));
    expect(onRowsChange).toHaveBeenLastCalledWith([{ sourceId: 'row-1', values: { 201: true } }]);
  });

  it('keeps the last row of a required section', () => {
    const { queryByRole } = renderSection(makeSection(), [{ sourceId: 'row-1', values: {} }]);

    expect(queryByRole('button', { name: 'Remove row' })).not.toBeInTheDocument();
  });

  it('adds a row with a new source identifier when the section allows multiple rows', () => {
    const { getByRole, onRowsChange } = renderSection(makeSection(), [{ sourceId: 'row-1', values: {} }]);

    fireEvent.click(getByRole('button', { name: 'Add Row' }));

    const rows = onRowsChange.mock.calls[0][0] as IFormSubmissionRow[];
    expect(rows).toHaveLength(2);
    expect(rows[1].sourceId).not.toEqual('row-1');
  });

  it('accepts only one row when the section does not allow multiple rows', () => {
    const { queryByRole } = renderSection(makeSection({ allow_multiple: false }), [{ sourceId: 'row-1', values: {} }]);

    expect(queryByRole('button', { name: 'Add Row' })).not.toBeInTheDocument();
  });

  it('shows rows without changing them when read-only', () => {
    const { getByLabelText, queryByRole } = renderSection(
      makeSection({ required_value: false }),
      [{ sourceId: 'row-1', values: { 200: 3 } }],
      true
    );

    expect(getByLabelText('Count')).toBeDisabled();
    expect(queryByRole('button', { name: 'Add Row' })).not.toBeInTheDocument();
    expect(queryByRole('button', { name: 'Remove row' })).not.toBeInTheDocument();
  });
});
