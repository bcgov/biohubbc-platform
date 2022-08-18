import { fireEvent, render, waitFor } from 'test-helpers/test-utils';
import { ErrorDialog } from './ErrorDialog';

describe('ErrorDialog', () => {
  it('renders correctly with Title and Text', () => {
    const { getByText } = render(
      <div id="root">
        <ErrorDialog
          dialogTitle="This is dialog title"
          dialogText="This is dialog text"
          open={true}
          onClose={() => jest.fn()}
          onOk={() => jest.fn()}
        />
      </div>
    );

    expect(getByText('This is dialog title')).toBeVisible();
    expect(getByText('This is dialog text')).toBeVisible();
  });

  it('renders correctly with Title, Text and Error msg', () => {
    const { getByText } = render(
      <div id="root">
        <ErrorDialog
          dialogTitle="This is dialog title"
          dialogText="This is dialog text"
          dialogError="This is dialog error"
          open={true}
          onClose={() => jest.fn()}
          onOk={() => jest.fn()}
        />
      </div>
    );

    expect(getByText('This is dialog title')).toBeVisible();
    expect(getByText('This is dialog text')).toBeVisible();
    expect(getByText('This is dialog error')).toBeVisible();
  });

  it('renders correctly with a detailed error message', async () => {
    const { getByText } = render(
      <div id="root">
        <ErrorDialog
          dialogTitle="This is dialog title"
          dialogText="This is dialog text"
          dialogErrorDetails={['an error', { error: 'another error' }]}
          dialogError="This is dialog error"
          open={true}
          onClose={() => jest.fn()}
          onOk={() => jest.fn()}
        />
      </div>
    );

    fireEvent.click(getByText('Show detailed error message'));

    await waitFor(() => {
      expect(getByText('an error')).toBeVisible();
      expect(getByText('{"error":"another error"}')).toBeVisible();
    });

    fireEvent.click(getByText('Hide detailed error message'));

    await waitFor(() => {
      expect(getByText('an error')).not.toBeVisible();
      expect(getByText('{"error":"another error"}')).not.toBeVisible();
    });
  });
});
