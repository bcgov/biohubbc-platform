import { fireEvent, screen } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { SubmissionUploadReconciliationTable } from './SubmissionUploadReconciliationTable';

describe('SubmissionUploadReconciliationTable', () => {
  it('renders each outcome and navigates even when its count is zero', () => {
    const onOutcomeClick = vi.fn();
    render(
      <SubmissionUploadReconciliationTable
        counts={{ new: 0, unmodified: 7, modified: 2 }}
        onOutcomeClick={onOutcomeClick}
      />
    );
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeVisible();
    for (const [label, route] of [
      ['New 0', 'new'],
      ['Unchanged 7', 'unchanged'],
      ['Changed 2', 'changed']
    ]) {
      fireEvent.click(screen.getByRole('row', { name: label }));
      expect(onOutcomeClick).toHaveBeenLastCalledWith(route);
    }
  });

  it.each(['Enter', ' '])('opens an outcome using the %s key', (key) => {
    const onOutcomeClick = vi.fn();
    render(
      <SubmissionUploadReconciliationTable
        counts={{ new: 0, unmodified: 7, modified: 2 }}
        onOutcomeClick={onOutcomeClick}
      />
    );
    fireEvent.keyDown(screen.getByRole('gridcell', { name: 'Unchanged' }), { key });
    expect(onOutcomeClick).toHaveBeenCalledWith('unchanged');
  });
});
