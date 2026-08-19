import { waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { FeaturePropertiesSection } from './FeaturePropertiesSection';

vi.mock('hooks/useApi');

const mockUseApi = useApi as Mock;
const mockGetSubmissionFeatureProperties = vi.fn();

const renderSection = (props: Partial<Parameters<typeof FeaturePropertiesSection>[0]> = {}) =>
  render(
    <MemoryRouter>
      <FeaturePropertiesSection
        submissionId="1"
        submissionFeatureId="10"
        featureRouteBasePath="/submission"
        {...props}
      />
    </MemoryRouter>
  );

describe('FeaturePropertiesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApi.mockReturnValue({
      features: {
        getSubmissionFeatureProperties: mockGetSubmissionFeatureProperties
      }
    });

    mockGetSubmissionFeatureProperties.mockResolvedValue({
      properties: [
        { id: 'string:1', property: 'species name', value: 'Wolf' },
        {
          id: 'taxon:2',
          property: 'focal species',
          value: { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' }
        }
      ],
      pagination: { total: 2, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  it('loads the indexed properties of the feature with the default sort and page size', async () => {
    const { findByText } = renderSection();

    expect(await findByText('Properties')).toBeVisible();
    await waitFor(() => {
      expect(mockGetSubmissionFeatureProperties).toHaveBeenCalledWith(
        '1',
        '10',
        expect.objectContaining({ page: 1, limit: 10, sort: 'property', order: 'asc' })
      );
    });
  });

  it('renders scalar values as text and taxon values as links under the given route base', async () => {
    const { findByText, findByRole } = renderSection({ featureRouteBasePath: '/portal/submission' });

    expect(await findByText('Wolf')).toBeVisible();
    expect(await findByRole('link', { name: 'Ursus americanus' })).toHaveAttribute(
      'href',
      '/portal/submission/1/taxon/180543'
    );
  });

  it('does not request properties without a submission and feature id', async () => {
    const { findByText } = renderSection({ submissionId: undefined, submissionFeatureId: undefined });

    expect(await findByText('No properties')).toBeVisible();
    expect(mockGetSubmissionFeatureProperties).not.toHaveBeenCalled();
  });
});
