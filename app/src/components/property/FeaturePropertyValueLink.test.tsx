import { fireEvent } from '@testing-library/react';
import { FeatureReferencePropertyValue } from 'interfaces/property-value.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { buildSubmissionPropertyValuePathResolvers } from 'utils/routes';
import { FeaturePropertyValueLink } from './FeaturePropertyValueLink';

const feature: FeatureReferencePropertyValue = { urn: 'urn:18:sample_site:3339', label: 'urn:18:sample_site:3339' };

const renderLink = (
  value: FeatureReferencePropertyValue,
  getSubmissionFeaturePath = buildSubmissionPropertyValuePathResolvers('/submission').getSubmissionFeaturePath
) =>
  render(
    <MemoryRouter>
      <FeaturePropertyValueLink value={value} getSubmissionFeaturePath={getSubmissionFeaturePath} />
    </MemoryRouter>
  );

describe('FeaturePropertyValueLink', () => {
  it('links the label to the referenced feature path provided by the caller', () => {
    const getSubmissionFeaturePath = vi.fn(() => '/submission/18/feature/3339?view=table');
    const { getByRole } = renderLink(feature, getSubmissionFeaturePath);

    const link = getByRole('link', { name: 'urn:18:sample_site:3339' });
    expect(link).toHaveAttribute('href', '/submission/18/feature/3339?view=table');
    expect(link).toHaveAttribute('title', 'urn:18:sample_site:3339');
    expect(getSubmissionFeaturePath).toHaveBeenCalledWith(18, 3339);
  });

  it('uses the portal route base when given', () => {
    const { getByRole } = renderLink(
      feature,
      buildSubmissionPropertyValuePathResolvers('/portal/submission').getSubmissionFeaturePath
    );

    expect(getByRole('link')).toHaveAttribute('href', '/portal/submission/18/feature/3339');
  });

  it('renders plain text when the urn does not identify a single feature', () => {
    const { getByText, queryByRole } = renderLink({ urn: 'urn:*:telemetry:*', label: 'urn:*:telemetry:*' });

    expect(getByText('urn:*:telemetry:*')).toBeInTheDocument();
    expect(queryByRole('link')).toBeNull();
  });

  it('does not propagate its click to an enclosing clickable row', () => {
    const onRowClick = vi.fn();
    const { getByRole } = render(
      <MemoryRouter>
        <div onClick={onRowClick}>
          <FeaturePropertyValueLink
            value={feature}
            getSubmissionFeaturePath={buildSubmissionPropertyValuePathResolvers('/submission').getSubmissionFeaturePath}
          />
        </div>
      </MemoryRouter>
    );

    fireEvent.click(getByRole('link'));

    expect(onRowClick).not.toHaveBeenCalled();
  });
});
