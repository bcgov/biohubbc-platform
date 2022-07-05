import React from 'react'

import {
    Box,
    Button,
    //Card,
    Input,
    InputAdornment,
    Theme,
    //Typography
} from '@material-ui/core'
import { Icon } from '@mdi/react';
import { mdiMagnify } from '@mdi/js';
import { useFormikContext } from 'formik';
import { IAdvancedSearch } from 'interfaces/useSearchApi.interface';
import { makeStyles } from '@material-ui/styles';


const useStyles = makeStyles((theme: Theme) => ({
    actionButton: {
      minWidth: '6rem',
      '& + button': {
        marginLeft: '0.5rem'
      }
    },
  
    keywordSearch: {
      height: '52px',
      flex: '1 1 auto',
      paddingLeft: theme.spacing(1.25),
      display: 'flex',
      alignItems: 'center',
      border: '1px solid rgba(0, 0, 0, 0.23)',
      borderRadius: '4px 0 0 4px',
      backgroundColor: '#f6f6f6',
      transition: 'all ease-out 0.25s',
      '&:hover': {
        borderColor: theme.palette.primary.main,
        boxShadow: '0 0 0 1px #003366 inset'
      },
      '&:active': {
        borderColor: theme.palette.primary.main,
        boxShadow: '0 0 0 1px #003366 inset'
      },
      '&:focus': {
        borderColor: theme.palette.primary.main,
        boxShadow: '0 0 0 1px #003366 inset'
      }
    },
    filterToggleBtn: {
      height: '100%',
      flex: '0 0 auto',
      borderRadius: '0 4px 4px 0',
      marginLeft: '-1px'
    },
    filterApplyBtn: {
      height: '100%',
      minWidth: '8rem'
    },
    chipStyle: {
      color: 'white',
      backgroundColor: '#38598a',
      textTransform: 'capitalize'
    }
  }));

export default () => {

    const classes = useStyles();
    
    const formikProps = useFormikContext<IAdvancedSearch>();
    const { handleSubmit, handleChange, values } = formikProps;

    return (
        <div>
            
                <Box display="flex">
                <Box flex="1 1 auto" display="flex">
                    <Input
                    tabIndex={0}
                    className={classes.keywordSearch}
                    name="keywords"
                    fullWidth
                    startAdornment={
                        <InputAdornment position="start">
                            <Icon path={mdiMagnify} size={1} />
                        </InputAdornment>
                    }
                    disableUnderline={true}
                    placeholder="Enter a species name or keywords"
                    onChange={handleChange}
                    value={values.keywords}
                    />
                </Box>
                <Box flex="0 0 auto" ml={1}>
                    <Button
                        type="submit"
                        size="large"
                        variant="contained"
                        color="primary"
                        className={classes.filterApplyBtn}
                        onClick={() => handleSubmit()}>
                      Search
                    </Button>
                </Box>
                </Box>
            
        </div>
    )
}
