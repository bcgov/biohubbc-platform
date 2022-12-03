import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { grey } from '@mui/material/colors';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
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
          <List
            disablePadding
            sx={{
              '& li': {
                border: `1px solid ${grey[400]}`
              },
              '& li + li': {
                borderTop: 'none'
              },
              '& li:first-of-type': {
                mt: 1,
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px'
              },
              '& li:last-of-type': {
                borderBottomLeftRadius: '4px',
                borderBottomRightRadius: '4px'
              }
            }}
          >
            {!!formikProps.values[props.list_name].length &&
              formikProps.values[props.list_name].map((data: any, index: any) => {
                return (
                  <ListItem
                    sx={{
                      borderStyle: 'solid',
                      borderColor: 'grey.300'
                    }}
                    key={`${data.value ? data.value : data.name}-listItem`}
                    secondaryAction={
                      <IconButton
                        aria-label="Delete list item"
                        onClick={() => {
                          arrayHelpers.remove(index);
                        }}
                      >
                        <Icon path={mdiTrashCanOutline} size={0.875} />
                      </IconButton>
                    }
                  >
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
