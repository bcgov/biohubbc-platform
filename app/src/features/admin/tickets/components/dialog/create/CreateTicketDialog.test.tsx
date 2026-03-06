import { fireEvent, waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { CreateTicketDialog } from './CreateTicketDialog';

describe('CreateTicketDialog', () => {
  const renderDialog = (onSave = vi.fn()) =>
    render(<CreateTicketDialog open={true} isLoading={false} onCancel={vi.fn()} onSave={onSave} />);

  it('does not submit when required fields are missing', async () => {
    const onSave = vi.fn();
    const { getByTestId } = renderDialog(onSave);

    fireEvent.click(getByTestId('edit-dialog-save-button'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits form values with default medium priority when omitted', async () => {
    const onSave = vi.fn();
    const { getByLabelText, getByTestId } = renderDialog(onSave);

    fireEvent.change(getByLabelText(/Subject/i), { target: { value: 'Test Ticket' } });
    fireEvent.change(getByLabelText(/Description/i), { target: { value: 'Details' } });

    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        subject: 'Test Ticket',
        description: 'Details',
        priority: 'medium'
      });
    });
  });
});
