import { QueryClient } from '@tanstack/react-query';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { createTestQueryClient, spyOnInvalidatedQueryKeys } from 'test-helpers/query-client';
import { act, fireEvent, render, screen, waitFor } from 'test-helpers/test-utils';
import { FeatureSecurityRulesList } from './FeatureSecurityRulesList';

const mocks = vi.hoisted(() => ({ remove: vi.fn(), getRules: vi.fn() }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    admin: {
      deleteSubmissionUploadReviewSecurityRuleAssignments: mocks.remove,
      getSubmissionUploadReviewFeatureRules: mocks.getRules
    }
  })
}));

const rulesPage = (total = 2) => ({
  rules: [
    { security_rule_id: 4, name: 'Sensitive', description: 'Sensitive locations', provenance: 'direct' },
    { security_rule_id: 5, name: 'Inherited rule', description: 'Parent protection', provenance: 'inherited' }
  ],
  pagination: { total, current_page: 1, last_page: 1, per_page: 10 }
});

const props = {
  submissionId: 1,
  submissionUploadId: 'upload',
  submissionUploadReviewId: 'review'
};

describe('FeatureSecurityRulesList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    mocks.remove.mockResolvedValue(undefined);
    mocks.getRules.mockResolvedValue(rulesPage());
  });

  it('loads the first page of rules for the feature with the abort signal', async () => {
    render(<FeatureSecurityRulesList {...props} submissionFeatureId={10} />, { queryClient });

    expect(await screen.findByText('Sensitive locations')).toBeVisible();
    expect(mocks.getRules).toHaveBeenCalledWith(
      1,
      'upload',
      'review',
      10,
      { page: 1, limit: 10, sort: 'name', order: 'asc' },
      { signal: expect.any(AbortSignal) }
    );
  });

  it('shows fetch errors with retry and clears them on a successful fetch', async () => {
    mocks.getRules.mockRejectedValueOnce(new Error('Rules failed'));
    render(<FeatureSecurityRulesList {...props} submissionFeatureId={10} />, { queryClient });

    expect(await screen.findByRole('alert')).toHaveTextContent('Rules failed');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Sensitive locations')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.getRules).toHaveBeenCalledTimes(2);
  });

  it('shows descriptions and removes only the direct rule from this feature, then invalidates security', async () => {
    const invalidatedKeys = spyOnInvalidatedQueryKeys(queryClient);
    render(<FeatureSecurityRulesList {...props} submissionFeatureId={10} />, { queryClient });

    expect(await screen.findByText('Sensitive locations')).toBeVisible();
    expect(screen.getByText('Parent protection')).toBeVisible();
    const buttons = screen.getAllByRole('button', { name: 'Remove' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledTimes(2));
    expect(mocks.remove).toHaveBeenCalledWith(1, 'upload', 'review', [10], 4);
    expect(invalidatedKeys()).toEqual([
      submissionUploadQueryKeys.securityRules(props),
      submissionUploadQueryKeys.featureSearchResultsAll(props)
    ]);
  });

  it('steps back a page when the last rule on a later page is removed', async () => {
    mocks.getRules.mockResolvedValue({ ...rulesPage(11), rules: [rulesPage().rules[0]] });
    render(<FeatureSecurityRulesList {...props} submissionFeatureId={10} />, { queryClient });
    await screen.findByText('Sensitive locations');
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    await waitFor(() =>
      expect(mocks.getRules).toHaveBeenLastCalledWith(
        1,
        'upload',
        'review',
        10,
        expect.objectContaining({ page: 2 }),
        expect.anything()
      )
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(mocks.getRules).toHaveBeenLastCalledWith(
        1,
        'upload',
        'review',
        10,
        expect.objectContaining({ page: 1 }),
        expect.anything()
      )
    );
  });

  it('keeps the rule and displays errors when removal fails', async () => {
    mocks.remove.mockRejectedValue(new Error('Removal failed'));
    const invalidatedKeys = spyOnInvalidatedQueryKeys(queryClient);
    render(<FeatureSecurityRulesList {...props} submissionFeatureId={10} />, { queryClient });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Removal failed');
    expect(screen.getByText('Sensitive locations')).toBeVisible();
    expect(invalidatedKeys()).toEqual([]);
  });

  it('keeps removal available while a request is pending', async () => {
    let resolve!: () => void;
    mocks.remove.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    render(<FeatureSecurityRulesList {...props} submissionFeatureId={10} />, { queryClient });

    const button = await screen.findByRole('button', { name: 'Remove' });
    fireEvent.click(button);
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledOnce());

    expect(button).toBeEnabled();
    await act(async () => resolve());
  });
});
