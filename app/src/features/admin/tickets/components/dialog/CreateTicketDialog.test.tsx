import { fireEvent, waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { CreateTicketDialog } from './CreateTicketDialog';

describe('CreateTicketDialog', () => {
  it('does not submit when required fields are missing', async () => {
    const onCreate = vi.fn();

    const { getByTestId } = render(
      <CreateTicketDialog open={true} isSaving={false} onClose={vi.fn()} onCreate={onCreate} />
    );

    fireEvent.click(getByTestId('edit-dialog-save-button'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('submits with default MEDIUM priority when omitted', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);

    const { getByLabelText, getByTestId } = render(
      <CreateTicketDialog open={true} isSaving={false} onClose={vi.fn()} onCreate={onCreate} />
    );

    fireEvent.change(getByLabelText(/Title/i), { target: { value: 'Test Ticket' } });
    fireEvent.change(getByLabelText(/Description/i), { target: { value: 'Details' } });

    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        title: 'Test Ticket',
        description: 'Details',
        priority: 'MEDIUM'
      });
    });
  });
});
