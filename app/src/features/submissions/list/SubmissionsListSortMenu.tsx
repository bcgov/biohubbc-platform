import { mdiChevronDown, mdiSortAscending, mdiSortDescending, mdiSortReverseVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { MenuItem, useTheme } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import { FuseResult } from 'fuse.js';
import { SubmissionRecord } from 'interfaces/useSubmissionsApi.interface';
import sortBy from 'lodash-es/sortBy';
import React, { useState } from 'react';
import { objectKeys } from 'utils/Utils';

export type SortSubmission = FuseResult<SubmissionRecord> | SubmissionRecord;

type SortProp = { key: keyof SubmissionRecord; sort: 'asc' | 'desc' };

export interface ISubmissionsListSortMenuProps<TSubmission> {
  /**
   * Submissions to sort
   *
   * @type {TSubmission[]}
   * @memberof ISubmissionsListSortMenuProps
   */
  submissions: TSubmission[];

  /**
   * Callback fired after submissions are sorted
   *
   * @param {TSubmission[]} - data
   * @returns {void}
   * @memberof ISubmissionsListSortMenuProps
   */
  handleSubmissions: (data: TSubmission[]) => void;

  /**
   * Sort menu items
   * The object values will be the labels for the menu items
   *
   * @type {Partial<Record<keyof SubmissionRecord, string>>}
   * @example: { name: 'Name', publish_timestamp: 'Publish Date' }
   * @memberof ISubmissionsListSortMenuProps
   */
  sortMenuItems: Partial<Record<keyof SubmissionRecord, string>>;

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
  apiSortSync?: SortProp;
}

/**
 * Renders 'Sort By' button for Submission pages
 *
 * Note: supports both submission and fuzzy submission types
 * @param {ISubmissionsListSortMenuProps} props
 * @returns {*}
 */
const SubmissionsListSortMenu = <TSubmission extends SortSubmission>(
  props: ISubmissionsListSortMenuProps<TSubmission>
) => {
  const { submissions, sortMenuItems, handleSubmissions, apiSortSync } = props;

  const theme = useTheme();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [sortProp, setSortProp] = useState<SortProp | undefined>(apiSortSync);

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
   * @param {SortProp} _sortProp - property and direction of sort
   */
  const sortSubmissions = (_sortProp: SortProp) => {
    const getSortKey = (submission: SortSubmission) =>
      // uncertain why this needs to be cast to FuseResult when checking for item property?
      'item' in submission
        ? (submission as FuseResult<SubmissionRecord>).item[_sortProp.key]
        : submission[_sortProp.key];

    const sortedData: TSubmission[] =
      _sortProp.sort === 'asc' ? sortBy(submissions, getSortKey) : sortBy(submissions, getSortKey).reverse();

    return sortedData;
  };

  const handleMenuItemClick = (sortKey: keyof SubmissionRecord) => {
    const sortDirection = !sortProp || sortProp.sort === 'desc' ? 'asc' : 'desc';
    const newSortProp: SortProp = {
      key: sortKey,
      sort: sortDirection
    };

    const sortedSubmissions = sortSubmissions(newSortProp);

    handleSubmissions(sortedSubmissions);
    setSortProp(newSortProp);
    handleClose();
  };

  const getSortIcon = (sortKey: keyof SubmissionRecord) => {
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
          <MenuItem key={key} onClick={() => handleMenuItemClick(key)} dense>
            <Icon path={getSortIcon(key)} size={1} style={{ marginRight: theme.spacing(1.5) }} />
            {sortMenuItems[key]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default SubmissionsListSortMenu;
