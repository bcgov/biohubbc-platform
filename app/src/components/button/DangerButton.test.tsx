import AddIcon from '@mui/icons-material/Add';
import { render } from 'test-helpers/test-utils';
import { DangerButton } from './DangerButton';

describe('DangerButton', () => {
  it('applies danger defaults', () => {
    const { getByRole } = render(<DangerButton>Delete</DangerButton>);

    const button = getByRole('button', { name: 'Delete' });

    expect(button.className).toContain('MuiButton-contained');
    expect(button.className).toContain('MuiButton-containedError');
    expect(button.className).toContain('MuiButton-sizeMedium');
  });

  it('allows overriding defaults', () => {
    const { getByRole } = render(
      <DangerButton color="primary" size="small">
        Delete
      </DangerButton>
    );

    const button = getByRole('button', { name: 'Delete' });

    expect(button.className).toContain('MuiButton-containedPrimary');
    expect(button.className).toContain('MuiButton-sizeSmall');
  });

  it('renders end icon', () => {
    const { getByTestId } = render(
      <DangerButton endIcon={<AddIcon data-testid="end-icon" />}>Delete</DangerButton>
    );

    expect(getByTestId('end-icon')).toBeVisible();
  });
});
