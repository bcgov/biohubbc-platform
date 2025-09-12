import { fireEvent, waitFor } from '@testing-library/react';
import DropZone from 'components/attachments/DropZone';
import { render } from 'test-helpers/test-utils';

const onFiles = vi.fn();

// You can define the max file size and max file count directly for testing
const maxUploadNumFiles = 10;
const maxUploadFileSize = 52428800; // 50 MB

const renderContainer = () => {
  return render(
    <DropZone
      onFiles={onFiles}
      acceptedFileExtensions={['.txt']}
      maxNumFiles={maxUploadNumFiles}
      maxFileSize={maxUploadFileSize}
    />
  );
};

describe('DropZone', () => {
  it('renders default instruction text', () => {
    const { getByTestId } = renderContainer();

    expect(getByTestId('dropzone-instruction-text').textContent).toEqual('Drag your files here, or Browse Files');
  });

  it('renders default maximum file size text', () => {
    const { getByTestId } = renderContainer();

    expect(getByTestId('dropzone-max-size-text').textContent).toEqual('Maximum size: 50 MB');
  });

  it('renders default maximum file count text', () => {
    const { getByTestId } = renderContainer();

    expect(getByTestId('dropzone-max-files-text').textContent).toEqual('Maximum files: 10');
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
