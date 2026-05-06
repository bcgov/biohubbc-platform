import { ClickAwayListener, Paper, Popper, Stack } from '@mui/material';
import { SearchInput } from 'components/search/SearchInput';
import { PropsWithChildren, useEffect, useRef, useState } from 'react';

interface SearchResultHeaderProps {
  searchTerm: string;
  isFilterPanelOpen: boolean;
  onFilterPanelOpenChange: (isOpen: boolean) => unknown;
  onSearchTermChange: (value: string) => unknown;
  onClear: () => unknown;
}

/**
 * Search input and anchored filter popover for the search results page.
 *
 * Use this layout component when a results page needs a text search input with
 * a popover anchored to the input width. The parent owns `searchTerm` and the
 * open/closed state; this component only handles anchoring, resizing, click-away
 * behavior, and forwarding search input changes.
 *
 * The click-away handler deliberately ignores MUI popper/menu/presentation
 * elements so nested controls inside `ExpressionBuilder` can open their own
 * option menus without closing the filter popover.
 *
 * @param {SearchResultHeaderProps} props
 * @returns {JSX.Element} Search header with optional anchored popover content.
 */
export const SearchResultHeader = (props: PropsWithChildren<SearchResultHeaderProps>) => {
  const { searchTerm, isFilterPanelOpen, children, onFilterPanelOpenChange, onSearchTermChange, onClear } = props;
  const [filterPanelWidth, setFilterPanelWidth] = useState<number | null>(null);
  const [hasFilterPanelMounted, setHasFilterPanelMounted] = useState(false);
  const searchInputAnchorRef = useRef<HTMLDivElement | null>(null);
  const shouldRenderFilterPanel = isFilterPanelOpen || hasFilterPanelMounted;

  useEffect(() => {
    if (isFilterPanelOpen) {
      setHasFilterPanelMounted(true);
    }
  }, [isFilterPanelOpen]);

  useEffect(() => {
    const anchorElement = searchInputAnchorRef.current;

    if (!isFilterPanelOpen || !anchorElement) {
      return;
    }

    const updateFilterPanelWidth = () => {
      const nextWidth = anchorElement.getBoundingClientRect().width;
      setFilterPanelWidth(nextWidth > 0 ? nextWidth : null);
    };

    updateFilterPanelWidth();
    globalThis.addEventListener('resize', updateFilterPanelWidth);

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateFilterPanelWidth);
    resizeObserver?.observe(anchorElement);

    return () => {
      globalThis.removeEventListener('resize', updateFilterPanelWidth);
      resizeObserver?.disconnect();
    };
  }, [isFilterPanelOpen]);

  const handleClickAway = (event: MouseEvent | TouchEvent) => {
    if (!isFilterPanelOpen) {
      return;
    }

    const target = event.target;
    const targetElement = target instanceof Element ? target : null;
    const isSearchAnchorClick = target instanceof Node && searchInputAnchorRef.current?.contains(target);
    const isBuilderMenuClick = !!targetElement?.closest(
      '.MuiAutocomplete-popper, .MuiMenu-root, .MuiPopover-root, [role="presentation"]'
    );

    if (isSearchAnchorClick || isBuilderMenuClick) {
      return;
    }

    onFilterPanelOpenChange(false);
  };

  return (
    <Stack sx={{ width: '100%' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1}
        alignItems="center"
        justifyContent="center"
        sx={{ width: '100%' }}>
        <Stack ref={searchInputAnchorRef} sx={{ width: '100%', maxWidth: 640 }}>
          <SearchInput
            size="small"
            value={searchTerm}
            placeholder="Search..."
            onFocus={() => onFilterPanelOpenChange(true)}
            onChange={(event) => onSearchTermChange(event.target.value)}
            onClear={onClear}
          />
        </Stack>
      </Stack>

      <Popper
        open={isFilterPanelOpen}
        keepMounted
        anchorEl={searchInputAnchorRef.current}
        placement="bottom-start"
        sx={{
          zIndex: (theme) => theme.zIndex.modal,
          width: filterPanelWidth ?? undefined
        }}>
        <ClickAwayListener onClickAway={handleClickAway}>
          <Paper
            elevation={2}
            data-testid="filter-panel-popper-paper"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              mt: 1,
              width: '100%',
              maxHeight: '60vh',
              maxWidth: 'calc(100vw - 32px)',
              outline: '2px solid transparent',
              overflow: 'hidden',
              transition: 'none',
              '&:has([data-root-drop-active="true"])': {
                outlineColor: 'primary.main'
              }
            }}>
            {shouldRenderFilterPanel ? children : null}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Stack>
  );
};
