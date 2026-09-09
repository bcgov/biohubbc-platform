import type { SourceSpecification } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BC_BASEMAP_SOURCE_ID,
  buildBcBasemapLayer,
  buildBcBasemapSource,
  type BcBasemapMode
} from './bc-basemap-layers';
import {
  bcTileKey,
  findBcTileClassification,
  subscribeToBcTileClassifications,
  type BcBasemapTileClassification
} from './bc-basemap-registry';
import type { ISlippyMapLayer, ISlippyMapTile, ISlippyMapViewport } from './SlippyMap.interface';

/**
 * Decide which basemap a viewport should show from the tiles it needs.
 *
 * The BC basemap is shown only while every tile the viewport needs is one the service holds. A tile outside the
 * service's extent, or one it answered with nothing, rules that out at once; while any tile is still unknown the
 * current mode stands, so the map does not flip on a guess and flip back once the tile arrives.
 *
 * @param {ISlippyMapTile[]} requiredTiles - The BC source's covering tiles at the viewport.
 * @param {(key: string) => BcBasemapTileClassification | undefined} classify - Known classifications by tile key.
 * @param {BcBasemapMode} currentMode
 * @return {*}  {BcBasemapMode}
 */
export const resolveBcBasemapMode = (
  requiredTiles: ISlippyMapTile[],
  classify: (key: string) => BcBasemapTileClassification | undefined,
  currentMode: BcBasemapMode
): BcBasemapMode => {
  if (!requiredTiles.length) {
    return currentMode;
  }

  let isEveryTileContent = true;

  for (const tile of requiredTiles) {
    if (!tile.withinBounds) {
      return 'fallback';
    }

    const classification = classify(bcTileKey(tile));

    if (classification === 'missing') {
      return 'fallback';
    }

    if (classification === undefined) {
      isEveryTileContent = false;
    }
  }

  return isEveryTileContent ? 'bc' : currentMode;
};

export interface IUseBcBasemapResult {
  mode: BcBasemapMode;
  /** The BC basemap source, keyed by its id. Empty without a basemap URL. */
  tileSources: Record<string, SourceSpecification>;
  /** The BC basemap layer, carrying the current mode. Empty without a basemap URL. */
  layers: ISlippyMapLayer[];
  /** Hand the map's viewport reports here. */
  onViewportChange: (viewport: ISlippyMapViewport) => void;
}

/**
 * The BC Government basemap and the mode it should be shown in for the map's current viewport.
 *
 * The mode is re-evaluated whenever the viewport moves and whenever a tile is classified, since the tiles a viewport
 * needs arrive after the move that asked for them. It lives here rather than in the map so it survives the map being
 * rebuilt: a rebuilt map reports its viewport again on load.
 *
 * @param {string} [basemapUrl] - The provider's tile URL template. Without one there is no BC basemap.
 * @param {string} [attribution]
 * @return {*}  {IUseBcBasemapResult}
 */
export const useBcBasemap = (basemapUrl: string | undefined, attribution: string | undefined): IUseBcBasemapResult => {
  const [mode, setMode] = useState<BcBasemapMode>('bc');
  const modeRef = useRef<BcBasemapMode>('bc');
  const requiredTilesRef = useRef<ISlippyMapTile[]>([]);

  const evaluate = useCallback(() => {
    const nextMode = resolveBcBasemapMode(requiredTilesRef.current, findBcTileClassification, modeRef.current);

    if (nextMode !== modeRef.current) {
      modeRef.current = nextMode;
      setMode(nextMode);
    }
  }, []);

  const onViewportChange = useCallback(
    (viewport: ISlippyMapViewport) => {
      requiredTilesRef.current = viewport.coveringTiles(BC_BASEMAP_SOURCE_ID);
      evaluate();
    },
    [evaluate]
  );

  useEffect(() => subscribeToBcTileClassifications(evaluate), [evaluate]);

  const tileSources = useMemo(
    (): Record<string, SourceSpecification> =>
      basemapUrl ? { [BC_BASEMAP_SOURCE_ID]: buildBcBasemapSource(basemapUrl, attribution ?? '') } : {},
    [basemapUrl, attribution]
  );

  const layers = useMemo((): ISlippyMapLayer[] => (basemapUrl ? [buildBcBasemapLayer(mode)] : []), [basemapUrl, mode]);

  return { mode, tileSources, layers, onViewportChange };
};
