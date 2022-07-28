import { Box, Button, Input, InputAdornment, Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import { mdiMagnify } from '@mdi/js';
import { Icon } from '@mdi/react';
import { useFormikContext } from 'formik';
import { IAdvancedSearch } from 'interfaces/useSearchApi.interface';
import React from 'react';

const useStyles = makeStyles((theme: Theme) => ({
  searchInputContainer: {
    position: 'relative'
  },
  searchInput: {
    height: '56px',
    paddingLeft: theme.spacing(2),
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.23)',
    background: '#ffffff',
    outline: '4px solid transparent',
    outlineOffset: '-1px',
    transition: 'all ease-out 0.25s',
    '&.Mui-focused': {
      outline: '3px solid #3B99FC',
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

const SearchComponent: React.FC = () => {
  const classes = useStyles();

  const formikProps = useFormikContext<IAdvancedSearch>();
  const { handleSubmit, handleChange, values } = formikProps;

  return (
    <form onSubmit={handleSubmit} autoComplete="off">
      <Box className={classes.searchInputContainer}>
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
          placeholder="Enter a species name or keyword"
          onChange={handleChange}
          value={values.keywords}
        />
        <Button
          type="submit"
          size="large"
          variant="contained"
          color="primary"
          disableElevation
          disableRipple
          className={classes.searchInputBtn}
          onClick={() => handleSubmit()}>
          Search
        </Button>
      </Box>
    </form>
  );
};

export default SearchComponent;
