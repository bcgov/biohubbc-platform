import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ComponentDialog from 'components/dialog/ComponentDialog';
import { fireEvent, render, waitFor } from 'test-helpers/test-utils';

const handleOnClose = jest.fn();

const TestComponent = () => {
  return (
    <Box>
      <Typography>This is a test component</Typography>
    </Box>
  );
};

const renderContainer = ({ dialogTitle, open = true }: { dialogTitle: string; open?: boolean }) => {
  return render(
    <div id="root">
      <ComponentDialog dialogTitle={dialogTitle} open={open} onClose={handleOnClose}>
        <TestComponent />
      </ComponentDialog>
    </div>
  );
};

describe('ComponentDialog', () => {
  it('Does not render dialog pop up when open set to false', () => {
    const { queryByText } = renderContainer({ dialogTitle: 'this is a test', open: false });

    expect(queryByText('this is a test')).toEqual(null);
  });

  it('Does render dialog pop up when open set to true', () => {
    const { getByText } = renderContainer({ dialogTitle: 'this is a test', open: true });

    expect(getByText('this is a test')).toBeVisible();
  });

  it('calls the onClose prop when `Close` button is clicked', async () => {
    const { findByText } = renderContainer({ dialogTitle: 'this is a test' });

    const CloseButton = await findByText('Close', { exact: false });

    fireEvent.click(CloseButton);

    await waitFor(() => {
      expect(handleOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
