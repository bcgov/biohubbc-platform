import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    rows: { applied: boolean }[];
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
      {props.rows.map((rule, index) => (
        <button key={index} onClick={() => props.onChangeRule(rule)}>
          {rule.applied ? 'Applied' : 'Apply'}
        </button>
      ))}
      <button onClick={props.onReset}>Reset</button>
    </>
  )
}));

const response = (applied = false) => ({
  rules: [{ security_rule_id: 4, security_category_id: 2, name: 'Sensitive', category_name: 'Privacy', applied }],
  pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
});
const baseProps = {
  submissionId: 15,
  submissionUploadId: 'upload',
  submissionUploadReviewId: 'review',
  selectedFeatureIds: [10],
  refreshRevision: 0,
  onRuleChanged: vi.fn(),
  onChanged: vi.fn()
};
const expression = { type: 'expression' as const, operator: 'AND' as const, clauses: [] };

describe('SelectedFeatureRulesContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRules.mockResolvedValue(response());
    mocks.apply.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
    mocks.reset.mockResolvedValue(undefined);
  });

  it.each([false, true])('mutates applied=%s in place and refreshes only feature state', async (applied) => {
    mocks.getRules.mockResolvedValueOnce(response(applied)).mockResolvedValue(response(!applied));
    render(<SelectedFeatureRulesContainer {...baseProps} expression={expression} />);
    fireEvent.click(await screen.findByRole('button', { name: applied ? 'Applied' : 'Apply' }));
    await waitFor(() => expect(baseProps.onRuleChanged).toHaveBeenCalledOnce());
    expect(applied ? mocks.remove : mocks.apply).toHaveBeenCalledWith(15, 'upload', 'review', [10], 4, expression);
    expect(mocks.getRules).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: applied ? 'Apply' : 'Applied' })).toBeEnabled();
  });

  it('shows request failures locally and clears them after retry', async () => {
    mocks.getRules.mockRejectedValueOnce(new Error('Rules could not be loaded'));
    render(<SelectedFeatureRulesContainer {...baseProps} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Rules could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByRole('button', { name: 'Apply' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('preserves rule order after applying a rule', async () => {
    const initial = response();
    initial.rules.push({ ...initial.rules[0], security_rule_id: 5, name: 'Other' });
    mocks.getRules.mockResolvedValue(initial);
    render(<SelectedFeatureRulesContainer {...baseProps} />);
    const buttons = await screen.findAllByRole('button', { name: 'Apply' });
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(baseProps.onRuleChanged).toHaveBeenCalledOnce());
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Apply', 'Applied', 'Reset']);
    expect(mocks.getRules).toHaveBeenCalledOnce();
  });

  it.each([false, true])('optimistically toggles applied=%s and rolls back on failure', async (applied) => {
    mocks.getRules.mockResolvedValue(response(applied));
    let reject!: (error: Error) => void;
    (applied ? mocks.remove : mocks.apply).mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      })
    );
    render(<SelectedFeatureRulesContainer {...baseProps} />);
    fireEvent.click(await screen.findByRole('button', { name: applied ? 'Applied' : 'Apply' }));
    expect(screen.getByRole('button', { name: applied ? 'Apply' : 'Applied' })).toBeEnabled();
    expect(baseProps.onRuleChanged).not.toHaveBeenCalled();
    await act(async () => reject(new Error('Mutation failed')));
    expect(screen.getByRole('button', { name: applied ? 'Applied' : 'Apply' })).toBeEnabled();
    expect(mocks.snackbar).toHaveBeenCalled();
    expect(mocks.getRules).toHaveBeenCalledOnce();
    expect(baseProps.onRuleChanged).not.toHaveBeenCalled();
  });

  it('keeps reset and rule actions enabled while a mutation is pending', async () => {
    let finish!: () => void;
    mocks.apply.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    render(<SelectedFeatureRulesContainer {...baseProps} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Applied' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await act(async () => mocks.dialog.mock.calls[0][0].onYes());
    expect(mocks.reset).toHaveBeenCalledOnce();
    await act(async () => finish());
    await waitFor(() => expect(baseProps.onRuleChanged).toHaveBeenCalledOnce());
  });

  it.each([
    [[10], undefined, 'selected feature'],
    [[], expression, 'matching the current search'],
    [[], undefined, 'submission upload']
  ] as const)('resets scope %j with appropriate confirmation', async (ids, filter, text) => {
    render(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[...ids]} expression={filter} />);
    await screen.findByRole('button', { name: 'Apply' });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    const confirmation = mocks.dialog.mock.calls[0][0];
    expect(confirmation.dialogText).toContain(text);
    let finish!: () => void;
    mocks.reset.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    let pending!: Promise<void>;
    act(() => {
      pending = confirmation.onYes();
    });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    await act(async () => {
      finish();
      await pending;
    });
    expect(mocks.reset).toHaveBeenCalledWith(15, 'upload', 'review', ids, filter);
    expect(mocks.getRules).toHaveBeenCalledTimes(2);
    expect(baseProps.onChanged).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
  });

  it('refetches when scope inputs or refreshRevision change', async () => {
    const { rerender } = render(<SelectedFeatureRulesContainer {...baseProps} />);
    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledOnce());
    const ids = [20];
    rerender(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={ids} expression={expression} />);
    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledTimes(2));
    expect(mocks.getRules).toHaveBeenLastCalledWith(
      15,
      'upload',
      'review',
      ids,
      { keyword: '', expression },
      expect.anything()
    );
    rerender(
      <SelectedFeatureRulesContainer
        {...baseProps}
        selectedFeatureIds={ids}
        expression={expression}
        refreshRevision={1}
      />
    );
    await waitFor(() => expect(mocks.getRules).toHaveBeenCalledTimes(3));
  });

  it('reports an old-scope failure without restoring its rule state', async () => {
    let reject!: (error: Error) => void;
    mocks.apply.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      })
    );
    const { rerender } = render(<SelectedFeatureRulesContainer {...baseProps} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    mocks.getRules.mockResolvedValue(response(true));
    rerender(<SelectedFeatureRulesContainer {...baseProps} selectedFeatureIds={[]} expression={expression} />);
    await screen.findByRole('button', { name: 'Applied' });
    await act(async () => reject(new Error('Failed')));
    expect(screen.getByRole('button', { name: 'Applied' })).toBeEnabled();
    expect(mocks.snackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Failed' });
  });

  it('keeps controls available after reset fails', async () => {
    mocks.reset.mockRejectedValueOnce(new Error('Reset failed'));
    render(<SelectedFeatureRulesContainer {...baseProps} />);
    await screen.findByRole('button', { name: 'Apply' });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await act(async () => mocks.dialog.mock.calls[0][0].onYes());
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(mocks.snackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Reset failed' });
    expect(baseProps.onChanged).not.toHaveBeenCalled();
  });
});
