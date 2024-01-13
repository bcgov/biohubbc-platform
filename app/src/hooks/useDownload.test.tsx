import { renderHook } from '@testing-library/react-hooks';
import * as download from './useDownload';
describe('useDownload', () => {
  describe('mounting', () => {
    const { result } = renderHook(() => download.useDownload());
    it('should mount with both downloadJSON and downloadSignedURl', () => {
      expect(result.current.downloadJSON).toBeDefined();
      expect(result.current.downloadSignedUrl).toBeDefined();
    });
  });
});
