import Box from '@mui/material/Box';
import { tabsClasses } from '@mui/material/Tabs';
import { ITabGroupItem, TabGroup } from 'components/tabs/TabGroup';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildFeatureTypeTabsSx, getFeatureTypeTabsMask, revealSelectedFeatureTypeTab } from './FeatureTypeTabs.utils';

interface FeatureTypeTabsProps {
  /** Feature type of the selected tab. */
  activeFeatureType: string;
  /** A tab for each feature type, in display order. Pass a stable array, since a new one re-scrolls the row. */
  featureTypes: ITabGroupItem[];
  /** Selects another feature type. */
  onFeatureTypeChange: (featureTypeName: string) => void;
  /** Accessible name of the tab list. */
  ariaLabel: string;
  /** Test id of the row's container. */
  'data-testid'?: string;
}

/**
 * Renders a row of feature-type tabs that scrolls horizontally when the tabs do not fit.
 *
 * Scroll arrows on desktop overlay the ends of the row and show only while there are tabs to scroll to on their side,
 * so the first tab lines up with the content above it. The row fades out at each edge with more tabs past it, and the
 * selected tab is scrolled clear of the fades and arrows on load and on tab change. The row fills its container's
 * width.
 *
 * @param {FeatureTypeTabsProps} props - Selected feature type, the tabs, and the change handler.
 * @returns {JSX.Element} The scrollable feature-type tab row.
 */
export const FeatureTypeTabs = ({
  activeFeatureType,
  featureTypes,
  onFeatureTypeChange,
  ariaLabel,
  'data-testid': dataTestId
}: FeatureTypeTabsProps) => {
  const featureTypeTabsRef = useRef<HTMLDivElement>(null);
  const [featureTypeTabsMask, setFeatureTypeTabsMask] = useState<string>();

  /**
   * Fades out each end of the feature-type row while tabs extend past it.
   */
  const updateFeatureTypeTabsFade = useCallback(() => {
    const scroller = featureTypeTabsRef.current?.querySelector<HTMLElement>(`.${tabsClasses.scroller}`);

    if (!scroller) {
      setFeatureTypeTabsMask(undefined);
      return;
    }

    // Allow a pixel of rounding, since scroll offsets can be fractional at some zoom levels.
    const hasTabsToLeft = scroller.scrollLeft > 1;
    const hasTabsToRight = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;

    setFeatureTypeTabsMask(getFeatureTypeTabsMask(hasTabsToLeft, hasTabsToRight));
  }, []);

  useEffect(() => {
    const tabsElement = featureTypeTabsRef.current;

    if (!tabsElement) {
      return;
    }

    // This runs after MUI's own scroll on load, and before its scroll on a tab change, which then has nothing to do.
    const scroller = tabsElement.querySelector<HTMLElement>(`.${tabsClasses.scroller}`);

    if (scroller) {
      revealSelectedFeatureTypeTab(scroller);
    }

    updateFeatureTypeTabsFade();

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateFeatureTypeTabsFade);
    resizeObserver?.observe(tabsElement);

    return () => {
      resizeObserver?.disconnect();
    };
  }, [activeFeatureType, featureTypes, updateFeatureTypeTabsFade]);

  const featureTypeTabsSx = buildFeatureTypeTabsSx(featureTypeTabsMask);

  return (
    // Scroll events do not bubble, so the capture phase picks up the MUI scroller scrolling inside this box.
    <Box
      ref={featureTypeTabsRef}
      data-testid={dataTestId}
      onScrollCapture={updateFeatureTypeTabsFade}
      sx={{ flex: 1, minWidth: 0 }}>
      {featureTypes.length > 0 && (
        <TabGroup
          value={activeFeatureType}
          onChange={onFeatureTypeChange}
          ariaLabel={ariaLabel}
          tabs={featureTypes}
          variant="scrollable"
          sx={featureTypeTabsSx}
        />
      )}
    </Box>
  );
};
