import { CodePropertyValue } from 'interfaces/property-value.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { buildSubmissionPropertyValuePathResolvers } from 'utils/routes';
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
  getSubmissionCodePath?: (submissionId: number, codesetKey: string, codeKey: string) => string;
}

const renderLink = (value: CodePropertyValue, options: RenderOptions = {}) => {
  const {
    submissionId = 3,
    getSubmissionCodePath = buildSubmissionPropertyValuePathResolvers('/submission').getSubmissionCodePath
  } = options;

  return render(
    <MemoryRouter>
      <CodePropertyValueLink value={value} submissionId={submissionId} getSubmissionCodePath={getSubmissionCodePath} />
    </MemoryRouter>
  );
};

describe('CodePropertyValueLink', () => {
  it('links the label to the code path provided by the caller', () => {
    const getSubmissionCodePath = vi.fn(() => '/submission/3/code/sign/track?view=table');
    const { getByRole } = renderLink(code, { submissionId: 3, getSubmissionCodePath });

    const link = getByRole('link', { name: 'Track' });
    expect(link).toHaveAttribute('href', '/submission/3/code/sign/track?view=table');
    expect(getSubmissionCodePath).toHaveBeenCalledWith(3, 'sign', 'track');
  });

  it('uses the portal route base when given', () => {
    const { getByRole } = renderLink(code, {
      submissionId: 3,
      getSubmissionCodePath: buildSubmissionPropertyValuePathResolvers('/portal/submission').getSubmissionCodePath
    });

    expect(getByRole('link', { name: 'Track' })).toHaveAttribute('href', '/portal/submission/3/code/sign/track');
  });

  it('describes the code with its codeset and code labels', () => {
    const { getByRole } = renderLink(code, { submissionId: 3 });

    expect(getByRole('link')).toHaveAttribute('title', 'Sign / Track');
  });
});
