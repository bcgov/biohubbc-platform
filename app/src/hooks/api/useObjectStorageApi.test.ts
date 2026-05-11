import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { useObjectStorageApi } from './useObjectStorageApi';

describe('useObjectStorageApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('uploads a file to a presigned object storage URL with the provided content type', async () => {
    const url = 'https://object-store.example/upload';
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    mock.onPut(url).reply(200);

    await useObjectStorageApi().uploadFileToUrl({
      url,
      file,
      contentType: file.type
    });

    expect(mock.history.put[0].url).toBe(url);
    expect(mock.history.put[0].data).toBe(file);
    expect(mock.history.put[0].headers?.['Content-Type']).toBe('text/plain');
  });

  it('defaults to octet-stream when no content type is provided', async () => {
    const url = 'https://object-store.example/upload';
    const file = new File(['binary'], 'binary.dat');

    mock.onPut(url).reply(200);

    await useObjectStorageApi().uploadFileToUrl({
      url,
      file
    });

    expect(mock.history.put[0].headers?.['Content-Type']).toBe('application/octet-stream');
  });
});
