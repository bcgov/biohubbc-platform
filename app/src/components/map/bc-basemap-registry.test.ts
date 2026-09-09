import { BC_BASEMAP_CLASSIFICATION_LIMIT } from 'constants/basemap';
import {
  bcTileKey,
  clearBcTileClassifications,
  findBcTileClassification,
  recordBcTileClassification,
  subscribeToBcTileClassifications
} from './bc-basemap-registry';

describe('bc-basemap-registry', () => {
  beforeEach(() => {
    clearBcTileClassifications();
  });

  it('keys a tile by zoom, column and row', () => {
    expect(bcTileKey({ z: 11, x: 323, y: 700 })).toBe('11/323/700');
  });

  it('answers what was recorded for a tile, and nothing for one never fetched', () => {
    recordBcTileClassification('11/323/700', 'content');

    expect(findBcTileClassification('11/323/700')).toBe('content');
    expect(findBcTileClassification('11/324/700')).toBeUndefined();
  });

  it('notifies subscribers when a classification is recorded or changes', () => {
    const listener = vi.fn();
    subscribeToBcTileClassifications(listener);

    recordBcTileClassification('11/323/700', 'content');
    recordBcTileClassification('11/323/700', 'content');
    recordBcTileClassification('11/323/700', 'missing');

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying once unsubscribed', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToBcTileClassifications(listener);

    unsubscribe();
    recordBcTileClassification('11/323/700', 'content');

    expect(listener).not.toHaveBeenCalled();
  });

  it('forgets the oldest classification once past the limit', () => {
    for (let index = 0; index <= BC_BASEMAP_CLASSIFICATION_LIMIT; index++) {
      recordBcTileClassification(`11/${index}/0`, 'content');
    }

    expect(findBcTileClassification('11/0/0')).toBeUndefined();
    expect(findBcTileClassification('11/1/0')).toBe('content');
    expect(findBcTileClassification(`11/${BC_BASEMAP_CLASSIFICATION_LIMIT}/0`)).toBe('content');
  });

  it('forgets everything when cleared', () => {
    recordBcTileClassification('11/323/700', 'content');

    clearBcTileClassifications();

    expect(findBcTileClassification('11/323/700')).toBeUndefined();
  });
});
