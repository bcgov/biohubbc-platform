import { QueryClient } from '@tanstack/react-query';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { createTestQueryClient, spyOnInvalidatedQueryKeys } from 'test-helpers/query-client';
import { act, fireEvent, render, screen, waitFor } from 'test-helpers/test-utils';
import { SelectedFeatureRulesContainer } from './SelectedFeatureRulesContainer';

const mocks = vi.hoisted(() => ({
  getRules: vi.fn(),
  apply: vi.fn(),
  remove: vi.fn(),
  reset: vi.fn(),
  dialog: vi.fn(),
  snackbar: vi.fn()
}));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    admin: {
      getSubmissionUploadReviewSelectedFeatureRules: mocks.getRules,
      insertSubmissionUploadReviewSecurityRuleAssignments: mocks.apply,
      deleteSubmissionUploadReviewSecurityRuleAssignments: mocks.remove,
      deleteSubmissionUploadReviewSecurityAssignments: mocks.reset
    }
  })
}));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setYesNoDialog: mocks.dialog, setSnackbar: mocks.snackbar })
}));
vi.mock('./SelectedFeatureRulesPanel', () => ({
  SelectedFeatureRulesPanel: (props: {
    rows: { name: string; applied: boolean }[];
    onChangeRule: (rule: unknown) => void;
    onReset: () => void;
    error?: unknown;
    onRetry: () => void;
  }) => (
    <>
      {props.error ? (
        <div role="alert">
          {(props.error as Error).message}
          <button onClick={props.onRetry}>Try Again</button>
        </div>
      ) : null}
      {props.rows.map((rule) => (
        <button key={rule.name} aria-label={rule.name} onClick={() => props.onChangeRule(rule)}>
          {rule.applied ? 'Applied' : 'Apply'}
        </button>
      ))}
      <button onClick={props.onReset}>Reset</button>
    </>
  )
}));

const rule = (securityRuleId: number, name: string, applied: boolean) => ({
  security_rule_id: securityRuleId,
  security_category_id: 2,
  name,
  category_name: 'Privacy',
  applied
});
const response = (...rules: ReturnType<typeof rule>[]) => ({
  rules,
  pagination: { total: rules.length, current_page: 1, last_page: 1, per_page: 10 }
});
const baseProps = {
  submissionId: 15,
  submissionUploadId: 'upload',
  submissionUploadReviewId: 'review',
  selectedFeatureIds: [10]
};
const expression = { type: 'expression' as const, operator: 'AND' as const, clauses: [] };

/**
 * Returns a promise with its resolve and reject functions exposed.
 *
 * @returns The promise and its settle functions.
 */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const feature = { submissionId: 15, submissionUploadId: 'upload' };
const review = { ...feature, submissionUploadReviewId: 'review' };

describe('SelectedFeatureRulesContainer', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    mocks.getRules.mockResolvedValue(response(rule(4, 'Sensitive', false)));
    mocks.apply.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
    mocks.reset.mockResolvedValue(undefined);
  });

  it.each([false, true])(
    'toggles applied=%s in place and invalidates feature security, not the rules grid or the count',
    async (applied) => {
      mocks.getRules.mockResolvedValue(response(rule(4, 'Sensitive', applied)));
      const invalidatedKeys = spyOnInvalidatedQueryKeys(queryClient);
      render(<SelectedFeatureRulesContainer {...baseProps} expression={expression} />, { queryClient });

      fireEvent.click(await screen.findByRole('button', { name: 'Sensitive' }));

      await waitFor(() => expect(invalidatedKeys()).toHaveLength(2));
      expect(applied ? mocks.remove : mocks.apply).toHaveBeenCalledWith(15, 'upload', 'review', [10], 4, expression);
      expect(invalidatedKeys()).toEqual([
        submissionUploadQueryKeys.featureSearchResultsAll(feature),
        submissionUploadQueryKeys.featureRulesAll(review)
      ]);
      expect(mocks.getRules).toHaveBeenCalledOnce();
      expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent(applied ? 'Apply' : 'Applied');
    }
  );

  it('sends the applied scope and the abort signal with the rules request', async () => {
    render(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[]} expression={expression} />, {
      queryClient
    });

    await screen.findByRole('button', { name: 'Sensitive' });

    expect(mocks.getRules).toHaveBeenCalledWith(
      15,
      'upload',
      'review',
      [],
      { keyword: '', expression },
      { page: 1, limit: 10, sort: 'applied', order: 'desc' },
      { signal: expect.any(AbortSignal) }
    );
  });

  it('shows request failures locally and clears them after retry', async () => {
    mocks.getRules.mockRejectedValueOnce(new Error('Rules could not be loaded'));
    render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });

    expect(await screen.findByRole('alert')).toHaveTextContent('Rules could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await screen.findByRole('button', { name: 'Sensitive' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('preserves rule order after applying a rule', async () => {
    mocks.getRules.mockResolvedValue(response(rule(4, 'Sensitive', false), rule(5, 'Other', false)));
    render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });

    fireEvent.click(await screen.findByRole('button', { name: 'Other' }));

    await waitFor(() => expect(mocks.apply).toHaveBeenCalledOnce());
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Apply', 'Applied', 'Reset']);
    expect(mocks.getRules).toHaveBeenCalledOnce();
  });

  it.each([false, true])('optimistically toggles applied=%s and rolls back on failure', async (applied) => {
    mocks.getRules.mockResolvedValue(response(rule(4, 'Sensitive', applied)));
    const request = deferred<void>();
    (applied ? mocks.remove : mocks.apply).mockReturnValueOnce(request.promise);
    const invalidatedKeys = spyOnInvalidatedQueryKeys(queryClient);
    render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });

    fireEvent.click(await screen.findByRole('button', { name: 'Sensitive' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent(applied ? 'Apply' : 'Applied')
    );
    await act(async () => request.reject(new Error('Mutation failed')));

    await waitFor(() =>
      expect(mocks.snackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Mutation failed' })
    );
    expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent(applied ? 'Applied' : 'Apply');
    expect(mocks.getRules).toHaveBeenCalledOnce();
    expect(invalidatedKeys()).toEqual([]);
  });

  it('rolls back only the failed toggle, keeping a newer toggle of another rule', async () => {
    mocks.getRules.mockResolvedValue(response(rule(4, 'Sensitive', false), rule(5, 'Other', false)));
    const first = deferred<void>();
    mocks.apply.mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined);
    render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });

    fireEvent.click(await screen.findByRole('button', { name: 'Sensitive' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent('Applied'));
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledTimes(2));
    await act(async () => first.reject(new Error('Failed')));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent('Apply'));
    expect(screen.getByRole('button', { name: 'Other' })).toHaveTextContent('Applied');
  });

  it('keeps a newer toggle of the same rule when an older one fails', async () => {
    const first = deferred<void>();
    mocks.apply.mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined);
    render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });

    for (const label of ['Applied', 'Apply', 'Applied']) {
      fireEvent.click(await screen.findByRole('button', { name: 'Sensitive' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent(label));
    }
    await act(async () => first.reject(new Error('Failed')));

    await waitFor(() => expect(mocks.snackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Failed' }));
    expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent('Applied');
  });

  it('keeps reset and rule actions enabled while a mutation is pending', async () => {
    const request = deferred<void>();
    mocks.apply.mockReturnValueOnce(request.promise);
    render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });

    fireEvent.click(await screen.findByRole('button', { name: 'Sensitive' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent('Applied'));

    expect(screen.getByRole('button', { name: 'Sensitive' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await act(async () => mocks.dialog.mock.calls[0][0].onYes());
    expect(mocks.reset).toHaveBeenCalledOnce();
    await act(async () => request.resolve());
  });

  it.each([
    [[10], undefined, 'selected feature'],
    [[], expression, 'matching the current search'],
    [[], undefined, 'submission upload']
  ] as const)('resets scope %j with appropriate confirmation', async (ids, filter, text) => {
    const invalidatedKeys = spyOnInvalidatedQueryKeys(queryClient);
    render(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[...ids]} expression={filter} />, {
      queryClient
    });
    await screen.findByRole('button', { name: 'Sensitive' });

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    const confirmation = mocks.dialog.mock.calls[0][0];
    expect(confirmation.dialogText).toContain(text);
    await act(async () => confirmation.onYes());

    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledTimes(2));
    expect(mocks.reset).toHaveBeenCalledWith(15, 'upload', 'review', ids, filter);
    expect(invalidatedKeys()).toEqual([
      submissionUploadQueryKeys.securityRules(review),
      submissionUploadQueryKeys.featureSearchResultsAll(feature)
    ]);
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
  });

  it('refetches when the selection or applied expression changes', async () => {
    const { rerender } = render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });
    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledOnce());

    rerender(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[20]} expression={expression} />);

    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledTimes(2));
    expect(mocks.getRules).toHaveBeenLastCalledWith(
      15,
      'upload',
      'review',
      [20],
      { keyword: '', expression },
      expect.anything(),
      expect.anything()
    );
  });

  it('does not refetch when an equal selection arrives as a new array', async () => {
    const { rerender } = render(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[]} />, {
      queryClient
    });
    await screen.findByRole('button', { name: 'Sensitive' });

    rerender(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[]} />);

    expect(mocks.getRules).toHaveBeenCalledOnce();
  });

  it('loads the new scope when it changes during a request for the old one', async () => {
    const oldScope = deferred<ReturnType<typeof response>>();
    mocks.getRules.mockReturnValueOnce(oldScope.promise).mockResolvedValueOnce(response(rule(4, 'Sensitive', true)));
    const { rerender } = render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });
    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledOnce());

    rerender(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[20]} />);
    await screen.findByRole('button', { name: 'Sensitive' });
    await act(async () => oldScope.resolve(response(rule(4, 'Sensitive', false))));

    expect(mocks.getRules.mock.calls[0][6].signal.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent('Applied');
  });

  it('ignores a toggle of a row kept on screen from the previous scope while the new scope loads', async () => {
    const newScope = deferred<ReturnType<typeof response>>();
    const { rerender } = render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });
    await screen.findByRole('button', { name: 'Sensitive' });

    mocks.getRules.mockReturnValueOnce(newScope.promise);
    rerender(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[20]} />);
    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Sensitive' }));
    await act(async () => newScope.resolve(response(rule(4, 'Sensitive', true))));

    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent('Applied');
  });

  it('leaves a newly loaded scope alone when a toggle in the old scope fails', async () => {
    const request = deferred<void>();
    mocks.apply.mockReturnValueOnce(request.promise);
    const { rerender } = render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });
    fireEvent.click(await screen.findByRole('button', { name: 'Sensitive' }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledOnce());

    mocks.getRules.mockResolvedValue(response(rule(4, 'Sensitive', true)));
    rerender(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[]} expression={expression} />);
    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledTimes(2));
    await act(async () => request.reject(new Error('Failed')));

    expect(screen.getByRole('button', { name: 'Sensitive' })).toHaveTextContent('Applied');
    expect(mocks.snackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Failed' });
  });

  it('keeps controls available after reset fails', async () => {
    mocks.reset.mockRejectedValueOnce(new Error('Reset failed'));
    const invalidatedKeys = spyOnInvalidatedQueryKeys(queryClient);
    render(<SelectedFeatureRulesContainer {...baseProps} />, { queryClient });
    await screen.findByRole('button', { name: 'Sensitive' });

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await act(async () => mocks.dialog.mock.calls[0][0].onYes());

    await waitFor(() => expect(mocks.snackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Reset failed' }));
    expect(screen.getByRole('button', { name: 'Sensitive' })).toBeEnabled();
    expect(invalidatedKeys()).toEqual([]);
  });
});
