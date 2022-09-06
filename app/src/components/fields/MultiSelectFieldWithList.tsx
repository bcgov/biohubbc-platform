import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { List, ListItem } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import MultiAutocompleteField, { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import { FieldArray, useFormikContext } from 'formik';
import React from 'react';

export interface IMultiAutocompleteFieldWithListProps {
  id: string;
  label: string;
  options: IMultiAutocompleteFieldOption[];
  list_name: string;
  required?: boolean;
  filterLimit?: number;
  displayType?: string;
}

export interface IMultiSelectFieldWithList {
  list_name: { label: any; value: any }[];
  onListUpdate: (item: any) => void;
}

const MultiSelectFieldWithList: React.FC<IMultiAutocompleteFieldWithListProps> = (props) => {
  console.log('props in Multiselect with List:', props);

  const formikProps = useFormikContext<IMultiSelectFieldWithList>();

  console.log('formikProps values in multiselect with List:', formikProps.values);

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
                <ListItem key={`${data.value}-area`}>
                  {data.label}
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
  />;

  return (
    <MultiAutocompleteField
      id={props.id}
      label={props.label}
      options={props.options}
      required={props.required}
      displayType={props.displayType}
    />
  );
};

export default MultiSelectFieldWithList;
