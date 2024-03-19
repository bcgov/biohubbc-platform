import { mdiChevronDown, mdiSortAscending, mdiSortDescending, mdiSortReverseVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { MenuItem, useTheme } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import { FuseResult } from 'fuse.js';
import sortBy from 'lodash-es/sortBy';
import React, { useState } from 'react';
import { objectKeys } from 'utils/Utils';

export type Sortable<RecordType> = FuseResult<RecordType> | RecordType;

type SortProp<SortableRecordType> = { key: keyof SortableRecordType; sort: 'asc' | 'desc' };

export interface ISubmissionsListSortMenuProps<
  RecordType extends object,
  SortableRecordType extends Sortable<RecordType>
> {
  /**
   * Submissions to sort
   *
   * @type {SortableRecordType[]}
   * @memberof ISubmissionsListSortMenuProps
   */
  submissions: SortableRecordType[];

  /**
   * Callback fired after submissions are sorted
   *
   * @param {SortableRecordType[]} - data
   * @returns {void}
   * @memberof ISubmissionsListSortMenuProps
   */
  handleSubmissions: (data: SortableRecordType[]) => void;

  /**
   * Sort menu items
   * The object values will be the labels for the menu items
   *
   * @type {Partial<Record<keyof RecordType, string>>}
   * @example: { name: 'Name', publish_timestamp: 'Publish Date' }
   * @memberof ISubmissionsListSortMenuProps
   */
  sortMenuItems: Partial<Record<keyof RecordType, string>>;

  /**
   * Manually syncs the default sort with what api responds with
   *
   * Note: This does not sort the submissions, only sets the default selected sort of the menu.
   * Open to suggestions on a better way to implement this
   *
   * @type {SortProp}
   * @example: { key: 'publish_timetamp', sort: 'desc' }
   * @memberof ISubmissionsListSortMenuProps
   */
  apiSortSync?: SortProp<RecordType>;
}

/**
 * Renders 'Sort By' button for Submission pages
 *
 * Note: supports both submission and fuzzy submission types
 *
 * @template RecordType
 * @template SortableRecordType
 * @param {ISubmissionsListSortMenuProps<RecordType, SortableRecordType>} props
 * @return {*}
 */
const SubmissionsListSortMenu = <RecordType extends object, SortableRecordType extends Sortable<RecordType>>(
  props: ISubmissionsListSortMenuProps<RecordType, SortableRecordType>
) => {
  const { submissions, sortMenuItems, handleSubmissions, apiSortSync } = props;

  const theme = useTheme();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [sortProp, setSortProp] = useState<SortProp<RecordType> | undefined>(apiSortSync);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  /**
   * sorts submissions by property
   *
   * @param {SortProp<RecordType>} _sortProp _sortProp - property and direction of sort
   */
  const sortSubmissions = (_sortProp: SortProp<RecordType>) => {
    const getSortKey = (submission: Sortable<RecordType>) =>
      // uncertain why this needs to be cast to FuseResult when checking for item property?
      'item' in submission ? submission.item[_sortProp.key] : submission[_sortProp.key];

    const sortedData: SortableRecordType[] =
      _sortProp.sort === 'asc' ? sortBy(submissions, getSortKey) : sortBy(submissions, getSortKey).reverse();

    return sortedData;
  };

  const handleMenuItemClick = (sortKey: keyof RecordType) => {
    const sortDirection = !sortProp || sortProp.sort === 'desc' ? 'asc' : 'desc';
    const newSortProp: SortProp<RecordType> = {
      key: sortKey,
      sort: sortDirection
    };

    const sortedSubmissions = sortSubmissions(newSortProp);

    handleSubmissions(sortedSubmissions);
    setSortProp(newSortProp);
    handleClose();
  };

  const getSortIcon = (sortKey: keyof RecordType) => {
    if (!sortProp || sortKey !== sortProp.key) {
      return mdiSortReverseVariant;
    }
    if (sortProp.sort === 'asc') {
      return mdiSortAscending;
    }
    return mdiSortDescending;
  };

  return (
    <>
      <Button
        id="sort-button"
        onClick={handleClick}
        variant="outlined"
        disableElevation
        size="small"
        endIcon={<Icon path={mdiChevronDown} size={0.75} />}
        disabled={!submissions.length}>
        Sort By
      </Button>
      <Menu
        id="sort-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        keepMounted
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
        sx={{
          marginTop: 1
        }}>
        {objectKeys(sortMenuItems).map((key) => (
          <MenuItem key={String(key)} onClick={() => handleMenuItemClick(key)} dense>
            <Icon path={getSortIcon(key)} size={1} style={{ marginRight: theme.spacing(1.5) }} />
            {sortMenuItems[key]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default SubmissionsListSortMenu;
