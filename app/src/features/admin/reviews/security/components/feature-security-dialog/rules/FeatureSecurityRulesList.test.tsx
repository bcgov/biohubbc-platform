import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FeatureSecurityRulesList } from './FeatureSecurityRulesList';

const mocks = vi.hoisted(() => ({ remove: vi.fn(), refresh: vi.fn(), getRules: vi.fn(), fetcher: vi.fn() }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    admin: {
      deleteSubmissionUploadReviewSecurityRuleAssignments: mocks.remove,
      getSubmissionUploadReviewFeatureRules: mocks.getRules
    }
  })
}));
vi.mock('hooks/useServerPaginatedDataGrid', () => ({
  useServerPaginatedDataGrid: (options: { fetcher: typeof mocks.fetcher }) => {
    mocks.fetcher = options.fetcher;
    return {
      rows: [
        { security_rule_id: 4, name: 'Sensitive', description: 'Sensitive locations', provenance: 'direct' },
        {
          security_rule_id: 5,
          name: 'Inherited rule',
          description: 'Parent protection',
          provenance: 'inherited'
        }
      ],
      rowCount: 2,
      paginationModel: { page: 0, pageSize: 10 },
      isLoading: false,
      refresh: mocks.refresh
    };
  }
}));

const props = {
  submissionId: 1,
  submissionUploadId: 'upload',
  submissionUploadReviewId: 'review',
  submissionFeatureId: 10,
  onChanged: vi.fn()
};

describe('FeatureSecurityRulesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.remove.mockResolvedValue(undefined);
  });

  it('shows fetch errors with retry and clears them on a successful fetch', async () => {
    mocks.getRules
      .mockRejectedValueOnce(new Error('Rules failed'))
      .mockResolvedValue({ rules: [], pagination: { total: 0 } });
    render(<FeatureSecurityRulesList {...props} />);
    await act(async () => {
      await expect(mocks.fetcher('', { page: 1, limit: 10 })).rejects.toThrow('Rules failed');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Rules failed');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    await act(async () => {
      await mocks.fetcher('', { page: 1, limit: 10 });
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows descriptions and removes only the direct rule from this feature, then refreshes', async () => {
    render(<FeatureSecurityRulesList {...props} />);
    expect(screen.getByText('Sensitive locations')).toBeVisible();
    expect(screen.getByText('Parent protection')).toBeVisible();
    const buttons = screen.getAllByRole('button', { name: 'Remove' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toBeEnabled();
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.remove).toHaveBeenCalledWith(1, 'upload', 'review', [10], 4);
    expect(props.onChanged).toHaveBeenCalledOnce();
  });

  it('keeps the rule and displays errors when removal fails', async () => {
    mocks.remove.mockRejectedValue(new Error('Removal failed'));
    render(<FeatureSecurityRulesList {...props} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Removal failed');
    expect(screen.getByText('Sensitive locations')).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it('keeps removal available while a request is pending', async () => {
    let resolve!: () => void;
    mocks.remove.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    render(<FeatureSecurityRulesList {...props} />);
    const button = screen.getByRole('button', { name: 'Remove' });
    fireEvent.click(button);
    expect(button).toBeEnabled();
    await act(async () => resolve());
  });
});
