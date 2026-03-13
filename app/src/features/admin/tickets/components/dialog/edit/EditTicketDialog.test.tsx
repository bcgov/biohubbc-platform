import { fireEvent, waitFor } from '@testing-library/react';
import { ITicket } from 'interfaces/useTicketsApi.interface';
import { render } from 'test-helpers/test-utils';
import { EditTicketDialog } from './EditTicketDialog';

describe('EditTicketDialog', () => {
  const ticket: ITicket = {
    ticket_id: '11111111-1111-1111-1111-111111111111',
    ticket_slug: '04900001',
    subject: 'Existing Subject',
    description: 'Existing Description',
    team_id: '22222222-2222-2222-2222-222222222222',
    create_date: '2026-03-01T00:00:00.000Z',
    priority: 'medium',
    status: 'open'
  };

  const renderDialog = (onSubmit = vi.fn()) =>
    render(<EditTicketDialog open={true} isLoading={false} ticket={ticket} onClose={vi.fn()} onSubmit={onSubmit} />);

  it('renders form with current ticket values', async () => {
    const { getByLabelText } = renderDialog();

    await waitFor(() => {
      expect(getByLabelText(/Subject/i)).toHaveValue('Existing Subject');
      expect(getByLabelText(/Description/i)).toHaveValue('Existing Description');
    });
  });

  it('does not submit when required fields are missing', async () => {
    const onSubmit = vi.fn();
    const { getByLabelText, getByTestId } = renderDialog(onSubmit);

    fireEvent.change(getByLabelText(/Subject/i), { target: { value: '' } });
    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('submits edited ticket values', async () => {
    const onSubmit = vi.fn();
    const { getByLabelText, getByTestId } = renderDialog(onSubmit);

    fireEvent.change(getByLabelText(/Subject/i), { target: { value: 'Updated Subject' } });
    fireEvent.change(getByLabelText(/Description/i), { target: { value: 'Updated Description' } });
    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        subject: 'Updated Subject',
        description: 'Updated Description',
        priority: 'medium'
      });
    });
  });
});
