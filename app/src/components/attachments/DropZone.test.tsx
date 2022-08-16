import { fireEvent, render, waitFor } from 'test-helpers/test-utils';
import DropZone from './DropZone';

const onFiles = jest.fn();

const renderContainer = () => {
  return render(<DropZone onFiles={onFiles} acceptedFileExtensions=".txt" />);
};

describe('DropZone', () => {
  it('renders component properly', () => {
    const { getByText } = renderContainer();

    expect(getByText("Browse Files", {exact: false})).toBeVisible();
  });

  it('calls the `onFiles` callback when files are selected', async () => {
    const { getByTestId } = renderContainer();

    const testFile = new File(['test png content'], 'testpng.txt', { type: 'text/plain' });

    const dropZoneInput = getByTestId('drop-zone-input');

    fireEvent.change(dropZoneInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(onFiles).toHaveBeenCalledWith([testFile], [], expect.any(Object));
    });
  });
});
