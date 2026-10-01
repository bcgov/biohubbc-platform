import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { SelectedFeatureRulesPanel } from './SelectedFeatureRulesPanel';

vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: (props: {
    rows: { security_rule_id: number }[];
    columns: { field: string; renderCell?: (params: { row: unknown }) => ReactNode }[];
  }) => (
    <div data-testid="selected-feature-rules-grid">
      {props.rows.map((row) => (
        <div key={row.security_rule_id}>
          {props.columns.map((column) => (
            <div key={column.field}>{column.renderCell?.({ row })}</div>
          ))}
        </div>
      ))}
    </div>
  )
}));

const rule = {
  security_rule_id: 4,
  security_category_id: 2,
  name: 'Sensitive',
  category_name: 'Privacy',
  applied: false
};

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

  it.each([
    [false, true],
    [true, false]
  ])('with isLoading=%s, the rule toggle is enabled=%s', (isLoading, enabled) => {
    render(
      <SelectedFeatureRulesPanel
        rows={[rule]}
        rowCount={1}
        isLoading={isLoading}
        error={undefined}
        searchTerm=""
        paginationModel={{ page: 0, pageSize: 10 }}
        onSearch={vi.fn()}
        onPaginationModelChange={vi.fn()}
        onChangeRule={vi.fn()}
        onReset={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(!enabled);
  });
});
