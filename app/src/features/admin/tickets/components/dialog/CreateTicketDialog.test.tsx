import { fireEvent, waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { CreateTicketDialog } from './CreateTicketDialog';

describe('CreateTicketDialog', () => {
  const renderDialog = (onCreate = vi.fn()) => {
    return {
      onCreate,
      ...render(<CreateTicketDialog open={true} isSaving={false} onClose={vi.fn()} onCreate={onCreate} />)
    };
  };

  it('does not submit when required fields are missing', async () => {
    const onCreate = vi.fn();
    const { getByTestId } = renderDialog(onCreate);

    fireEvent.click(getByTestId('edit-dialog-save-button'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('submits with default medium priority when omitted', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);

    const { getByLabelText, getByTestId } = renderDialog(onCreate);

    fireEvent.change(getByLabelText(/Subject/i), { target: { value: 'Test Ticket' } });
    fireEvent.change(getByLabelText(/Description/i), { target: { value: 'Details' } });

    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        title: 'Test Ticket',
        description: 'Details',
        priority: 'medium'
      });
    });
  });
});
