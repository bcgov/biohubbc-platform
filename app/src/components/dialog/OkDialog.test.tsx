import { fireEvent, waitFor } from '@testing-library/react';
import { OkDialog } from 'components/dialog/OkDialog';
import { render } from 'test-helpers/test-utils';

const handleOnClose = vi.fn();

const renderContainer = ({
  dialogTitle,
  dialogText,
  open = true
}: {
  dialogTitle: string;
  dialogText: string;
  open?: boolean;
}) => {
  return render(
    <div id="root">
      <OkDialog dialogTitle={dialogTitle} dialogText={dialogText} open={open} onClose={handleOnClose} />
    </div>
  );
};

describe('OkDialog', () => {
  it('does not render dialog pop up when open set to false', () => {
    const { queryByText } = renderContainer({ dialogTitle: 'this is a test', dialogText: 'this is text', open: false });

    expect(queryByText('this is a test')).toEqual(null);
  });

  it('does render dialog pop up when open set to true', () => {
    const { getByText } = renderContainer({ dialogTitle: 'this is a test', dialogText: 'this is text' });

    expect(getByText('this is a test')).toBeVisible();
  });

  it('calls the onClose prop when `Ok` button is clicked', async () => {
    const { getByTestId } = renderContainer({ dialogTitle: 'this is a test', dialogText: 'this is text' });
    const okButton = getByTestId('ok-button');

    fireEvent.click(okButton);

    await waitFor(() => {
      expect(handleOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
