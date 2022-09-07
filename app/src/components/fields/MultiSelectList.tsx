import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { List, ListItem } from '@mui/material';
import IconButton from '@mui/material/IconButton';
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
            dense
            disablePadding
            sx={{
              '& li': {
                display: 'flex',
                justifyContent: 'space-between',
                py: 0.75,
                px: 2,
                border: '1px solid #ccc',
                backgroundColor: '#ebedf2',
                fontSize: '14px'
              },
              '& li:first-of-type': {
                mt: 2,
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px'
              },
              '& li:last-child': {
                borderBottomLeftRadius: '4px',
                borderBottomRightRadius: '4px'
              },
              '& li + li': {
                mt: '-1px'
              }
            }}>
            {!!formikProps.values[props.list_name].length &&
              formikProps.values[props.list_name].map((data: any, index: any) => {
                return (
                  <ListItem key={`${data.value ? data.value : props.list_name}-area`}>
                    {data.label ? data.label : props.list_name}
                    <IconButton
                      aria-label="Delete boundary"
                      onClick={() => {
                        arrayHelpers.remove(index);
                      }}>
                      <Icon path={mdiTrashCanOutline} size={0.875} />
                    </IconButton>
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
