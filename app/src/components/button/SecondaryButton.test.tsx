import AddIcon from '@mui/icons-material/Add';
import { render } from 'test-helpers/test-utils';
import { SecondaryButton } from './SecondaryButton';

describe('SecondaryButton', () => {
  it('applies secondary defaults', () => {
    const { getByRole } = render(<SecondaryButton>View</SecondaryButton>);

    const button = getByRole('button', { name: 'View' });

    expect(button.className).toContain('MuiButton-outlined');
    expect(button.className).toContain('MuiButton-outlinedPrimary');
    expect(button.className).toContain('MuiButton-sizeMedium');
  });

  it('allows overriding defaults', () => {
    const { getByRole } = render(
      <SecondaryButton variant="contained" size="small">
        View
      </SecondaryButton>
    );

    const button = getByRole('button', { name: 'View' });

    expect(button.className).toContain('MuiButton-contained');
    expect(button.className).toContain('MuiButton-sizeSmall');
  });

  it('renders start icon', () => {
    const { getByTestId } = render(
      <SecondaryButton startIcon={<AddIcon data-testid="start-icon" />}>View</SecondaryButton>
    );

    expect(getByTestId('start-icon')).toBeVisible();
  });
});
