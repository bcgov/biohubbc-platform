import { fireEvent, waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { CreateDownloadDialog } from './CreateDownloadDialog';

const renderDialog = (overrides: Partial<React.ComponentProps<typeof CreateDownloadDialog>> = {}) =>
  render(
    <CreateDownloadDialog
      open={true}
      isSubmitting={false}
      defaultName="Animals download"
      onCancel={vi.fn()}
      onSave={vi.fn()}
      {...overrides}
    />
  );

describe('CreateDownloadDialog', () => {
  it('renders the dialog title and Create save button', () => {
    const { getByText, getByTestId } = renderDialog();

    expect(getByText('Create Download')).toBeVisible();
    expect(getByTestId('edit-dialog-save-button')).toHaveTextContent('Create');
  });

  it('pre-fills the Name input with the supplied defaultName', () => {
    const { getByLabelText } = renderDialog({ defaultName: 'Moose download' });

    expect(getByLabelText(/Name/i)).toHaveValue('Moose download');
  });

  it('does not render a Feature Types control', () => {
    const { queryByLabelText } = renderDialog();

    expect(queryByLabelText(/Feature Types/i)).not.toBeInTheDocument();
  });

  it('does not invoke onSave when the Name input is cleared', async () => {
    const onSave = vi.fn();
    const { getByLabelText, getByTestId } = renderDialog({ onSave });

    fireEvent.change(getByLabelText(/Name/i), { target: { value: '' } });
    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(getByLabelText(/Name/i)).toHaveValue('');
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('invokes onSave with the form values when valid', async () => {
    const onSave = vi.fn();
    const { getByLabelText, getByTestId } = renderDialog({ onSave });

    fireEvent.change(getByLabelText(/Name/i), { target: { value: 'Moose download' } });
    fireEvent.change(getByLabelText(/Description/i), { target: { value: 'Skeena' } });

    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Moose download',
          description: 'Skeena'
        })
      );
    });
  });

  it('invokes onCancel when the Cancel button is clicked', () => {
    const onCancel = vi.fn();
    const { getByTestId } = renderDialog({ onCancel });

    fireEvent.click(getByTestId('edit-dialog-cancel-button'));

    expect(onCancel).toHaveBeenCalled();
  });
});
