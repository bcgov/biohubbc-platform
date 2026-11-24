import Box from '@mui/material/Box';
import { touchRippleClasses } from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { SxProps, Theme } from '@mui/material/styles';
import { tabClasses } from '@mui/material/Tab';
import { tabScrollButtonClasses } from '@mui/material/TabScrollButton';
import { tabsClasses } from '@mui/material/Tabs';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ISearchContainerLink } from '../../container/tab/SearchTabs.interface';
import { SearchResultSearch } from './SearchResultSearch';

// Width of each feature-type scroll arrow, which overlays an end of the row.
const FEATURE_TYPE_TABS_SCROLL_BUTTON_WIDTH = 40;

// Size of the rounded hover and press highlight behind each arrow: the small arrow icon plus 8px of padding around it.
const FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SIZE = 36;

// Width of the fade at each end of the row that hints at tabs scrolled out of view. It runs out from under the arrow.
const FEATURE_TYPE_TABS_FADE_WIDTH = 96;

// Centres the arrow's hover highlight and click ripple around its icon.
const FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SX = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  right: 'auto',
  bottom: 'auto',
  width: FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SIZE,
  height: FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SIZE,
  transform: 'translate(-50%, -50%)',
  borderRadius: 1
} as const;

/**
 * Builds the mask that fades out each end of the feature-type row that has tabs scrolled out of view past it.
 *
 * @param {boolean} hasTabsToLeft - Whether tabs are scrolled out of view past the left edge.
 * @param {boolean} hasTabsToRight - Whether tabs are scrolled out of view past the right edge.
 * @returns {string | undefined} The CSS mask image, or `undefined` when every tab is in view.
 */
const getFeatureTypeTabsMask = (hasTabsToLeft: boolean, hasTabsToRight: boolean): string | undefined => {
  if (!hasTabsToLeft && !hasTabsToRight) {
    return undefined;
  }

  const leftStops = hasTabsToLeft ? `transparent, #000 ${FEATURE_TYPE_TABS_FADE_WIDTH}px` : '#000';
  const rightStops = hasTabsToRight ? `#000 calc(100% - ${FEATURE_TYPE_TABS_FADE_WIDTH}px), transparent` : '#000';

  return `linear-gradient(to right, ${leftStops}, ${rightStops})`;
};

/**
 * Scrolls the selected feature-type tab clear of the fades and scroll arrows at the ends of the row. MUI only scrolls
 * the selected tab flush with the edge of the row, which would leave it under an arrow. The browser clamps the scroll
 * offset, so the first and last tabs still sit at the edges, where there is nothing to fade and their arrow is hidden.
 *
 * @param {HTMLElement} scroller - MUI scroller that holds the feature-type tabs.
 */
const revealSelectedFeatureTypeTab = (scroller: HTMLElement) => {
  const selectedTabRect = scroller.querySelector('[aria-selected="true"]')?.getBoundingClientRect();

  if (!selectedTabRect) {
    return;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  const clearLeft = scrollerRect.left + FEATURE_TYPE_TABS_FADE_WIDTH;
  const clearRight = scrollerRect.right - FEATURE_TYPE_TABS_FADE_WIDTH;

  if (selectedTabRect.left < clearLeft) {
    scroller.scrollLeft -= clearLeft - selectedTabRect.left;
  } else if (selectedTabRect.right > clearRight) {
    scroller.scrollLeft += selectedTabRect.right - clearRight;
  }
};

interface SearchResultPageHeaderProps {
  /** Feature type currently resolved from the `/search/:featureType` route. */
  activeFeatureType: string;
  /** Ordered feature-type tabs available for the current code metadata. */
  featureTypeLinks: ISearchContainerLink[];
  /** Search text from the current URL query string. */
  searchTerm: string;
  /** Expression tree currently applied to result requests. */
  expressionTree: ExpressionTreeExpression | null;
  /** Applies a new expression tree from the search expression builder. */
  onExpressionApply: (expressionTree: ExpressionTreeExpression | null) => void;
  /** Navigates to another feature-type result tab while preserving relevant query params. */
  onFeatureTypeChange: (featureTypeName: string) => void;
  /** Optional content at the end of the tab row, set apart from the feature-type tabs by a divider. */
  tabsEndContent?: ReactNode;
}

/**
 * Renders the structured header for the feature search result page.
 *
 * Combines the expression-aware search input with a tab for every feature type. The feature-type tabs scroll
 * horizontally when they do not fit, with scroll arrows on desktop that overlay the ends of the row and show only
 * while there are tabs to scroll to on their side, so the first tab lines up with the search input. The tabs fade out
 * at each edge with more tabs past it, and the selected tab is scrolled clear of the fades. Optional end content
 * follows them after a vertical divider. Page-level hooks own expression apply behavior and tab navigation.
 *
 * @param {SearchResultPageHeaderProps} props - Current feature type, search state, tab links, and header callbacks.
 * @returns {JSX.Element} Page header with search expression input and feature-type tabs.
 */
export const SearchResultPageHeader = ({
  activeFeatureType,
  featureTypeLinks,
  searchTerm,
  expressionTree,
  onExpressionApply,
  onFeatureTypeChange,
  tabsEndContent
}: SearchResultPageHeaderProps) => {
  const featureTypeTabsRef = useRef<HTMLDivElement>(null);
  const [featureTypeTabsMask, setFeatureTypeTabsMask] = useState<string>();

  const hasTabs = featureTypeLinks.length > 0 || Boolean(tabsEndContent);

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
  }, [activeFeatureType, featureTypeLinks, updateFeatureTypeTabsFade]);

  // The arrows overlay the ends of the row rather than taking space beside it, so the first tab lines up with the search
  // input and the scroller keeps its width as the arrows appear. MUI hides each arrow while its end of the row is reached.
  const featureTypeTabsSx: SxProps<Theme> = {
    position: 'relative',
    [`& .${tabsClasses.scrollButtons}`]: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      zIndex: 1,
      width: FEATURE_TYPE_TABS_SCROLL_BUTTON_WIDTH,
      // MUI draws the arrows at 80% opacity, which would show the tabs beneath them through the background.
      opacity: 1,
      color: 'text.secondary',
      bgcolor: 'background.paper',
      transition: (theme) => theme.transitions.create(['opacity', 'color']),
      // The highlight is a rounded shape around the icon, while the arrow's opaque background still covers the tabs.
      '&::before': {
        ...FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SX,
        content: '""',
        transition: (theme) => theme.transitions.create('background-color')
      },
      '&:hover': { color: 'text.primary' },
      '&:hover::before': { bgcolor: 'grey.100' },
      '&:active::before': { bgcolor: 'grey.200' },
      // Positioned after the highlight, so the icon paints above it.
      '& svg': { position: 'relative' },
      [`& .${touchRippleClasses.root}`]: FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SX,
      [`&.${tabScrollButtonClasses.disabled}`]: { opacity: 0 }
    },
    [`& .${tabsClasses.scrollButtons}:first-child`]: { left: 0 },
    [`& .${tabsClasses.scrollButtons}:last-child`]: { right: 0 },
    // The fade masks only the scrolling tabs, so the scroll arrows over them stay fully visible.
    [`& .${tabsClasses.scroller}`]: { maskImage: featureTypeTabsMask, WebkitMaskImage: featureTypeTabsMask },
    // MUI gives every tab a 90px minimum width; these tabs size to their labels instead.
    [`& .${tabClasses.root}`]: { minWidth: 0 }
  };

  return (
    <PageHeader
      maxWidth="lg"
      subheader={
        <SearchResultSearch
          searchTerm={searchTerm}
          expressionTree={expressionTree}
          onExpressionApply={onExpressionApply}
        />
      }
      tabs={
        hasTabs ? (
          <Stack direction="row" gap={3}>
            {/* Scroll events do not bubble, so the capture phase picks up the MUI scroller scrolling inside this box. */}
            <Box
              ref={featureTypeTabsRef}
              data-testid="search-feature-type-tabs"
              onScrollCapture={updateFeatureTypeTabsFade}
              sx={{ flex: 1, minWidth: 0 }}>
              {featureTypeLinks.length > 0 && (
                <TabGroup
                  value={activeFeatureType}
                  onChange={onFeatureTypeChange}
                  ariaLabel="Search feature types"
                  tabs={featureTypeLinks}
                  variant="scrollable"
                  sx={featureTypeTabsSx}
                />
              )}
            </Box>
            {tabsEndContent && (
              <>
                <Divider orientation="vertical" flexItem />
                {tabsEndContent}
              </>
            )}
          </Stack>
        ) : undefined
      }
    />
  );
};
