import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import { FieldArray, useFormikContext } from 'formik';
import React from 'react';

export interface IMultiAutocompleteFieldWithListProps {
  list_name: string;
}

const MultiSelectFieldWithList: React.FC<IMultiAutocompleteFieldWithListProps> = (props) => {
  const formikProps = useFormikContext<IMultiAutocompleteFieldWithListProps>();

  return (
    <FieldArray
      name={props.list_name}
      render={(arrayHelpers) => (
        <>
          <List disablePadding>
            {!!formikProps.values[props.list_name].length &&
              formikProps.values[props.list_name].map((data: any, index: any) => {
                return (
                  <ListItem
                    component={Paper}
                    elevation={1}
                    sx={{
                      mt: 1,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'grey.300'
                    }}
                    key={`${data.value ? data.value : data.name}-listItem`}
                    secondaryAction={
                      <IconButton
                        aria-label="Delete list item"
                        onClick={() => {
                          arrayHelpers.remove(index);
                        }}>
                        <Icon path={mdiTrashCanOutline} size={0.875} />
                      </IconButton>
                    }>
                    <ListItemText
                      primary={data.label ? data.label : data.name}
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                    />
                  </ListItem>
                );
              })}
          </List>
        </>
      )}
    />
  );
};

export default MultiSelectFieldWithList;
