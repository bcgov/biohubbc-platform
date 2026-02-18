import AddIcon from '@mui/icons-material/Add';
import { render } from 'test-helpers/test-utils';
import { PrimaryButton } from './PrimaryButton';

describe('PrimaryButton', () => {
  it('applies primary defaults', () => {
    const { getByRole } = render(<PrimaryButton>Create</PrimaryButton>);

    const button = getByRole('button', { name: 'Create' });

    expect(button.className).toContain('MuiButton-contained');
    expect(button.className).toContain('MuiButton-containedPrimary');
    expect(button.className).toContain('MuiButton-sizeMedium');
  });

  it('allows overriding defaults', () => {
    const { getByRole } = render(
      <PrimaryButton variant="text" size="small">
        Create
      </PrimaryButton>
    );

    const button = getByRole('button', { name: 'Create' });

    expect(button.className).toContain('MuiButton-text');
    expect(button.className).toContain('MuiButton-sizeSmall');
  });

  it('renders start and end icons', () => {
    const { getByTestId } = render(
      <PrimaryButton startIcon={<AddIcon data-testid="start-icon" />} endIcon={<AddIcon data-testid="end-icon" />}>
        Create
      </PrimaryButton>
    );

    expect(getByTestId('start-icon')).toBeVisible();
    expect(getByTestId('end-icon')).toBeVisible();
  });
});
