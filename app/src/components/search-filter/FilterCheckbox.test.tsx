import { fireEvent, waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import FilterCheckbox from './FilterCheckbox';

describe('FilterCheckbox', () => {
  const mockOnAdd = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    name: 'test_property',
    displayName: 'Test Property',
    type: 'text' as const,
    isActive: false,
    onAdd: mockOnAdd,
    onRemove: mockOnRemove
  };

  it('renders the checkbox with display name', () => {
    const { getByText } = render(<FilterCheckbox {...defaultProps} />);

    expect(getByText('Test Property')).toBeVisible();
  });

  it('shows unchecked checkbox when not active', () => {
    const { getByRole } = render(<FilterCheckbox {...defaultProps} />);

    const checkbox = getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('shows checked checkbox when active', () => {
    const { getByRole } = render(<FilterCheckbox {...defaultProps} isActive={true} value="test value" />);

    const checkbox = getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('displays value badge when active with value', () => {
    const { getByText } = render(<FilterCheckbox {...defaultProps} isActive={true} value="my filter value" />);

    expect(getByText('my filter value')).toBeVisible();
  });

  it('shows input field when checkbox is clicked', async () => {
    const { getByRole, getByPlaceholderText } = render(<FilterCheckbox {...defaultProps} />);

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(getByPlaceholderText('Enter value...')).toBeVisible();
    });
  });

  it('shows number placeholder for number type', async () => {
    const { getByRole, getByPlaceholderText } = render(<FilterCheckbox {...defaultProps} type="number" />);

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(getByPlaceholderText('Enter number...')).toBeVisible();
    });
  });

  it('shows date input for datetime type', async () => {
    const { getByRole, container } = render(<FilterCheckbox {...defaultProps} type="datetime" />);

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      const dateInput = container.querySelector('input[type="date"]');
      expect(dateInput).toBeVisible();
    });
  });

  it('calls onAdd with value when Enter is pressed', async () => {
    const { getByRole, getByPlaceholderText } = render(<FilterCheckbox {...defaultProps} />);

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    const input = getByPlaceholderText('Enter value...');
    fireEvent.change(input, { target: { value: 'new value' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith('new value');
    });
  });

  it('cancels input when Escape is pressed', async () => {
    const { getByRole, getByPlaceholderText, queryByPlaceholderText } = render(<FilterCheckbox {...defaultProps} />);

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    const input = getByPlaceholderText('Enter value...');
    fireEvent.change(input, { target: { value: 'some value' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(queryByPlaceholderText('Enter value...')).not.toBeInTheDocument();
    });
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it('calls onAdd when confirm button is clicked', async () => {
    const { getByRole, getByPlaceholderText, getByLabelText } = render(<FilterCheckbox {...defaultProps} />);

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    const input = getByPlaceholderText('Enter value...');
    fireEvent.change(input, { target: { value: 'confirmed value' } });

    const confirmButton = getByLabelText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith('confirmed value');
    });
  });

  it('cancels when cancel button is clicked', async () => {
    const { getByRole, getByPlaceholderText, getByLabelText, queryByPlaceholderText } = render(
      <FilterCheckbox {...defaultProps} />
    );

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    const input = getByPlaceholderText('Enter value...');
    fireEvent.change(input, { target: { value: 'some value' } });

    const cancelButton = getByLabelText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(queryByPlaceholderText('Enter value...')).not.toBeInTheDocument();
    });
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it('calls onRemove when unchecking an active filter', async () => {
    const { getByRole } = render(<FilterCheckbox {...defaultProps} isActive={true} value="existing value" />);

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onRemove when clicking remove button on value badge', async () => {
    const { getByLabelText } = render(<FilterCheckbox {...defaultProps} isActive={true} value="existing value" />);

    const removeButton = getByLabelText('Remove filter');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call onAdd when confirming empty value', async () => {
    const { getByRole, getByPlaceholderText, getByLabelText, queryByPlaceholderText } = render(
      <FilterCheckbox {...defaultProps} />
    );

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    const input = getByPlaceholderText('Enter value...');
    fireEvent.change(input, { target: { value: '   ' } }); // whitespace only

    const confirmButton = getByLabelText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(queryByPlaceholderText('Enter value...')).not.toBeInTheDocument();
    });
    expect(mockOnAdd).not.toHaveBeenCalled();
  });
});
