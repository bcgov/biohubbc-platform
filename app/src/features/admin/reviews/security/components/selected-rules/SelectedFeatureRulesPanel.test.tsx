import { fireEvent, render, screen } from '@testing-library/react';
import { SelectedFeatureRulesPanel } from './SelectedFeatureRulesPanel';

vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: () => <div data-testid="selected-feature-rules-grid" />
}));

describe('SelectedFeatureRulesPanel', () => {
  it('renders an enabled primary text Reset action in the panel header', () => {
    const onReset = vi.fn();

    render(
      <SelectedFeatureRulesPanel
        rows={[]}
        rowCount={0}
        isLoading={false}
        error={undefined}
        searchTerm=""
        paginationModel={{ page: 0, pageSize: 10 }}
        onSearch={vi.fn()}
        onPaginationModelChange={vi.fn()}
        onChangeRule={vi.fn()}
        onReset={onReset}
        onRetry={vi.fn()}
      />
    );

    const resetButton = screen.getByRole('button', { name: 'Reset' });
    expect(resetButton).toBeEnabled();
    expect(resetButton).toHaveClass('MuiButton-textPrimary');

    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledOnce();
  });
});
