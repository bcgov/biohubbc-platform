import { IFormVersionLayout } from 'interfaces/useFormsApi.interface';
import {
  EMPTY_FORM_LAYOUT,
  IFormLayoutSection,
  moveSection,
  toCreateForm,
  toFormLayout,
  toSaveFormVersion
} from './formLayout';

const makeSection = (featureTypeId: number): IFormLayoutSection => ({
  featureTypeId,
  displayName: `Type ${featureTypeId}`,
  label: `Type ${featureTypeId}`,
  description: null,
  requiredValue: false,
  allowMultiple: false,
  fields: []
});

const savedLayout: IFormVersionLayout = {
  form: {
    form_id: 1,
    slug: 'caribou',
    contributor_id: 3,
    team_id: 'team-1',
    name: 'Caribou',
    description: 'Caribou observations',
    is_public: true,
    record_end_date: null
  },
  form_version: {
    form_version_id: 2,
    form_id: 1,
    blueprint_id: 4,
    version_number: 2,
    record_effective_date: '2026-10-29',
    record_end_date: null
  },
  sections: [
    {
      blueprint_feature_type_id: 10,
      feature_type_id: 100,
      feature_type_name: 'observation',
      feature_type_display_name: 'Observation',
      label: 'Sighting',
      description: null,
      required_value: true,
      allow_multiple: true,
      sort: 0,
      fields: [
        {
          blueprint_feature_type_property_id: 20,
          blueprint_feature_type_id: 10,
          feature_property_id: 200,
          feature_property_name: 'sex',
          feature_property_display_name: 'Sex',
          type_name: 'code',
          label: 'Sex',
          description: null,
          contributor_codeset_id: 50,
          sort: 0
        }
      ]
    }
  ]
};

describe('formLayout', () => {
  describe('moveSection', () => {
    it("moves a section to another section's position", () => {
      const sections = [makeSection(1), makeSection(2), makeSection(3)];

      expect(moveSection(sections, 3, 1).map((section) => section.featureTypeId)).toEqual([3, 1, 2]);
      expect(moveSection(sections, 1, 3).map((section) => section.featureTypeId)).toEqual([2, 3, 1]);
    });

    it('leaves the sections unchanged for an unknown or identical target', () => {
      const sections = [makeSection(1), makeSection(2)];

      expect(moveSection(sections, 1, 1)).toBe(sections);
      expect(moveSection(sections, 9, 1)).toBe(sections);
    });
  });

  it('builds the working copy from a saved published version', () => {
    const layout = toFormLayout(savedLayout);

    expect(layout).toMatchObject({
      formId: 1,
      formVersionId: 2,
      slug: 'caribou',
      contributorId: 3,
      teamId: 'team-1',
      isPublic: true,
      versionNumber: 2,
      isPublished: true,
      isRetired: false
    });
    expect(layout.sections[0]).toMatchObject({ featureTypeId: 100, label: 'Sighting', requiredValue: true });
    expect(layout.sections[0].fields[0]).toMatchObject({ featurePropertyId: 200, contributorCodesetId: 50 });
  });

  it('round-trips the working copy into the save payload in section order', () => {
    const payload = toSaveFormVersion(toFormLayout(savedLayout));

    expect(payload).toEqual({
      name: 'Caribou',
      description: 'Caribou observations',
      isPublic: true,
      sections: [
        {
          featureTypeId: 100,
          label: 'Sighting',
          description: null,
          requiredValue: true,
          allowMultiple: true,
          fields: [{ featurePropertyId: 200, label: 'Sex', description: null, contributorCodesetId: 50 }]
        }
      ]
    });
  });

  it('adds the slug and contributor to the create payload', () => {
    const payload = toCreateForm({ ...EMPTY_FORM_LAYOUT, slug: 'moose', contributorId: 7, name: 'Moose' });

    expect(payload).toMatchObject({ slug: 'moose', contributorId: 7, name: 'Moose', sections: [] });
  });
});
