import { CodePropertyValue } from 'interfaces/property-value.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { CodePropertyValueLink } from './CodePropertyValueLink';

const code: CodePropertyValue = {
  codeset_key: 'sign',
  codeset_label: 'Sign',
  code_key: 'track',
  code_label: 'Track',
  label: 'Track'
};

interface RenderOptions {
  submissionId?: number;
  featureRouteBasePath?: string;
  initialEntry?: string;
}

const renderLink = (value: CodePropertyValue, options: RenderOptions = {}) => {
  const { submissionId = 3, featureRouteBasePath = '/submission', initialEntry = '/x' } = options;

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CodePropertyValueLink value={value} submissionId={submissionId} featureRouteBasePath={featureRouteBasePath} />
    </MemoryRouter>
  );
};

describe('CodePropertyValueLink', () => {
  it('links the label to the code page under the referencing submission, keeping the query string', () => {
    const { getByRole } = renderLink(code, { submissionId: 3, initialEntry: '/x?view=table' });

    const link = getByRole('link', { name: 'Track' });
    expect(link).toHaveAttribute('href', '/submission/3/code/sign/track?view=table');
  });

  it('uses the portal route base when given', () => {
    const { getByRole } = renderLink(code, { submissionId: 3, featureRouteBasePath: '/portal/submission' });

    expect(getByRole('link', { name: 'Track' })).toHaveAttribute('href', '/portal/submission/3/code/sign/track');
  });

  it('describes the code with its codeset and code labels', () => {
    const { getByRole } = renderLink(code, { submissionId: 3 });

    expect(getByRole('link')).toHaveAttribute('title', 'Sign / Track');
  });
});
