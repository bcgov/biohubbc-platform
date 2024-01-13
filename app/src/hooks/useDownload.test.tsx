import { renderHook } from '@testing-library/react-hooks';
import useDownload from './useDownload';
describe('useDownload', () => {
  describe('mounting', () => {
    const { result } = renderHook(() => useDownload());
    it('should mount with both downloadJSON and downloadSignedURl', () => {
      expect(result.current.downloadJSON).toBeDefined();
      expect(result.current.downloadSignedUrl).toBeDefined();
    });
  });
});
