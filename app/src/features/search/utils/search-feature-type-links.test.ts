import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';
import { buildAllSearchFeatureTypeLinks, buildSearchFeatureTypeLinks } from './search-feature-type-links';

/**
 * Builds the code metadata's feature types, in the order the API lists them.
 *
 * @param {[string, string][]} featureTypes - Each feature type's name and display name.
 * @returns {IGetAllCodeSetsResponse['feature_type_with_properties']} The feature types, without properties.
 */
const makeFeatureTypes = (featureTypes: [string, string][]): IGetAllCodeSetsResponse['feature_type_with_properties'] =>
  featureTypes.map(([name, displayName], index) => ({
    feature_type: { feature_type_id: index + 1, name, display_name: displayName, description: null },
    properties: []
  })) as unknown as IGetAllCodeSetsResponse['feature_type_with_properties'];

const featureTypes = makeFeatureTypes([
  ['survey', 'Survey'],
  ['wetland_plot', 'Wetland Plot'],
  ['species_observation', 'Species Observation'],
  ['camera_deployment', 'Camera Deployment']
]);

describe('search feature type links', () => {
  it('builds only the priority feature types for the landing page quick links', () => {
    expect(buildSearchFeatureTypeLinks(featureTypes).map((link) => link.value)).toEqual([
      'species_observation',
      'survey'
    ]);
  });

  it('builds every feature type for the result page, priority types first, then the rest in API order', () => {
    expect(buildAllSearchFeatureTypeLinks(featureTypes)).toEqual([
      { value: 'species_observation', label: 'Observations', to: '/search/species_observation' },
      { value: 'survey', label: 'Surveys', to: '/search/survey' },
      { value: 'wetland_plot', label: 'Wetland Plot', to: '/search/wetland_plot' },
      { value: 'camera_deployment', label: 'Camera Deployment', to: '/search/camera_deployment' }
    ]);
  });

  it('builds no links before the code metadata loads', () => {
    expect(buildAllSearchFeatureTypeLinks(undefined)).toEqual([]);
  });
});
