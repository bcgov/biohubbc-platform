import { mdiMagnify } from '@mdi/js';
import { Icon } from '@mdi/react';
import { Theme } from '@mui/material';
import Input from '@mui/material/Input';
import InputAdornment from '@mui/material/InputAdornment';
import { makeStyles } from '@mui/styles';
import { ChangeEvent } from 'react';

export const useSearchInputStyles = makeStyles((theme: Theme) => ({
  searchInputContainer: {
    position: 'relative'
  },
  searchInput: {
    height: '56px',
    paddingLeft: theme.spacing(2),
    borderRadius: '5px',
    border: '1px solid #cccccc',
    background: '#f7f8fa',
    outline: '4px solid transparent',
    outlineOffset: '-1px',
    transition: 'all ease-out 0.25s',
    '&.Mui-focused': {
      outline: '3px solid #3B99FC'
    },
    '& .MuiInputAdornment-positionStart': {
      opacity: '0.5'
    }
  },
  searchInputBtn: {
    position: 'absolute',
    top: '50%',
    right: '6px',
    height: '46px',
    marginTop: '-23px',
    minWidth: '7rem',
    fontWeight: 700,
    fontSize: '16px',
    borderRadius: '5px',
    outline: '4px solid transparent',
    outlineOffset: '-2px',
    transition: 'all ease-out 0.25s',
    '&.Mui-focusVisible': {
      outline: '3px solid #3B99FC'
    },
    '&:hover': {
      outline: '3px solid #3B99FC'
    },
    '&:active': {
      outline: '3px solid #3B99FC'
    }
  },
  chipStyle: {
    color: 'white',
    backgroundColor: '#38598a',
    textTransform: 'capitalize'
  }
}));

interface ISearchInputProps {
  placeholderText: string;
  handleChange: (e: ChangeEvent<any>) => void;
  value: string;
}

export const SearchInput = (props: ISearchInputProps) => {
  const classes = useSearchInputStyles();
  return (
    <Input
      tabIndex={0}
      className={classes.searchInput}
      name="keywords"
      fullWidth
      startAdornment={
        <InputAdornment position="start">
          <Icon path={mdiMagnify} size={1} />
        </InputAdornment>
      }
      disableUnderline={true}
      placeholder={props.placeholderText}
      onChange={props.handleChange}
      value={props.value}
    />
  );
};
